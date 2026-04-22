from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional
import json

from database import engine, get_db, Base
from models import Device, PASpecs, LNASpecs, FilterSpecs, SwitchSpecs
from extractor import extract_specs
from storage import upload_pdf, delete_pdf

Base.metadata.create_all(bind=engine)

app = FastAPI(title="RF Datasheet Tool")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


def parse_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).replace("~", "").strip())
    except (ValueError, TypeError):
        return None


def save_type_specs(db: Session, device_id: int, device_type: str, specs: dict):
    if device_type == "PA":
        db.add(PASpecs(
            device_id=device_id,
            vcc_v=parse_float(specs.get("vcc_v")),
            icc_ma=parse_float(specs.get("icc_ma")),
            gain_db=parse_float(specs.get("gain_db")),
            gain_min_db=parse_float(specs.get("gain_min_db")),
            p1db_dbm=parse_float(specs.get("p1db_dbm")),
            psat_dbm=parse_float(specs.get("psat_dbm")),
            pae_percent=parse_float(specs.get("pae_percent")),
            s11_db=parse_float(specs.get("s11_db")),
            s22_db=parse_float(specs.get("s22_db")),
            notes=specs.get("notes"),
        ))
    elif device_type == "LNA":
        db.add(LNASpecs(
            device_id=device_id,
            vcc_v=parse_float(specs.get("vcc_v")),
            icc_ma=parse_float(specs.get("icc_ma")),
            gain_db=parse_float(specs.get("gain_db")),
            gain_min_db=parse_float(specs.get("gain_min_db")),
            nf_db=parse_float(specs.get("nf_db")),
            nf_max_db=parse_float(specs.get("nf_max_db")),
            iip3_dbm=parse_float(specs.get("iip3_dbm")),
            s11_db=parse_float(specs.get("s11_db")),
            notes=specs.get("notes"),
        ))
    elif device_type == "Filter":
        db.add(FilterSpecs(
            device_id=device_id,
            insertion_loss_db=parse_float(specs.get("insertion_loss_db")),
            insertion_loss_max_db=parse_float(specs.get("insertion_loss_max_db")),
            rejection_db=parse_float(specs.get("rejection_db")),
            return_loss_db=parse_float(specs.get("return_loss_db")),
            package=specs.get("package"),
            notes=specs.get("notes"),
        ))
    elif device_type == "Switch":
        db.add(SwitchSpecs(
            device_id=device_id,
            vcc_v=parse_float(specs.get("vcc_v")),
            insertion_loss_db=parse_float(specs.get("insertion_loss_db")),
            insertion_loss_max_db=parse_float(specs.get("insertion_loss_max_db")),
            isolation_db=parse_float(specs.get("isolation_db")),
            isolation_min_db=parse_float(specs.get("isolation_min_db")),
            p1db_dbm=parse_float(specs.get("p1db_dbm")),
            ports=specs.get("ports"),
            notes=specs.get("notes"),
        ))


@app.post("/api/upload")
async def upload_datasheet(
    file: UploadFile = File(...),
    freq_min: float = Form(...),
    freq_max: float = Form(...),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    pdf_bytes = await file.read()

    # Upload to COS
    try:
        stored_name, pdf_url = upload_pdf(pdf_bytes, file.filename)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")

    # Extract specs with Kimi
    try:
        result = extract_specs(pdf_bytes, freq_min, freq_max)
    except Exception as e:
        try:
            delete_pdf(stored_name)
        except Exception:
            pass
        raise HTTPException(500, f"Extraction failed: {str(e)}")

    # Save device
    device = Device(
        name=result.get("device_name", file.filename),
        manufacturer=result.get("manufacturer"),
        device_type=result.get("device_type"),
        freq_min_mhz=result.get("freq_min_mhz", freq_min),
        freq_max_mhz=result.get("freq_max_mhz", freq_max),
        pdf_filename=stored_name,
        pdf_url=pdf_url,
        raw_specs=result,
    )
    db.add(device)
    db.flush()

    # Save type-specific specs
    specs = result.get("specs", {})
    specs["notes"] = result.get("notes")
    save_type_specs(db, device.id, result.get("device_type", ""), specs)

    db.commit()
    db.refresh(device)

    return {"id": device.id, "name": device.name, "device_type": device.device_type}


@app.get("/api/devices")
def list_devices(
    device_type: Optional[str] = Query(None),
    freq_min: Optional[float] = Query(None),
    freq_max: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Device)
    if device_type:
        q = q.filter(Device.device_type == device_type)
    if freq_min is not None:
        q = q.filter(Device.freq_max_mhz >= freq_min)
    if freq_max is not None:
        q = q.filter(Device.freq_min_mhz <= freq_max)
    devices = q.order_by(Device.device_type, Device.name).all()

    result = []
    for d in devices:
        specs = _get_specs(db, d)
        result.append({
            "id": d.id,
            "name": d.name,
            "manufacturer": d.manufacturer,
            "device_type": d.device_type,
            "freq_min_mhz": d.freq_min_mhz,
            "freq_max_mhz": d.freq_max_mhz,
            "pdf_url": d.pdf_url,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "specs": specs,
        })
    return result


def _get_specs(db: Session, device: Device) -> dict:
    t = device.device_type
    if t == "PA":
        s = db.query(PASpecs).filter(PASpecs.device_id == device.id).first()
    elif t == "LNA":
        s = db.query(LNASpecs).filter(LNASpecs.device_id == device.id).first()
    elif t == "Filter":
        s = db.query(FilterSpecs).filter(FilterSpecs.device_id == device.id).first()
    elif t == "Switch":
        s = db.query(SwitchSpecs).filter(SwitchSpecs.device_id == device.id).first()
    else:
        return {}
    if not s:
        return {}
    d = {c.name: getattr(s, c.name) for c in s.__table__.columns}
    d.pop("id", None)
    d.pop("device_id", None)
    return d


@app.get("/api/devices/{device_id}")
def get_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(404, "Device not found")
    specs = _get_specs(db, device)
    return {
        "id": device.id,
        "name": device.name,
        "manufacturer": device.manufacturer,
        "device_type": device.device_type,
        "freq_min_mhz": device.freq_min_mhz,
        "freq_max_mhz": device.freq_max_mhz,
        "pdf_url": device.pdf_url,
        "raw_specs": device.raw_specs,
        "created_at": device.created_at.isoformat() if device.created_at else None,
        "specs": specs,
    }


@app.put("/api/devices/{device_id}/specs")
def update_specs(device_id: int, payload: dict, db: Session = Depends(get_db)):
    """Manually correct extracted specs"""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(404, "Device not found")
    t = device.device_type
    if t == "PA":
        s = db.query(PASpecs).filter(PASpecs.device_id == device_id).first()
    elif t == "LNA":
        s = db.query(LNASpecs).filter(LNASpecs.device_id == device_id).first()
    elif t == "Filter":
        s = db.query(FilterSpecs).filter(FilterSpecs.device_id == device_id).first()
    elif t == "Switch":
        s = db.query(SwitchSpecs).filter(SwitchSpecs.device_id == device_id).first()
    else:
        raise HTTPException(400, "Unknown device type")
    for k, v in payload.items():
        if hasattr(s, k):
            setattr(s, k, parse_float(v) if k not in ("notes", "package", "ports") else v)
    db.commit()
    return {"ok": True}


@app.delete("/api/devices/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(404, "Device not found")
    if device.pdf_filename:
        try:
            delete_pdf(device.pdf_filename)
        except Exception:
            pass
    db.delete(device)
    db.commit()
    return {"ok": True}


@app.get("/health")
def health():
    return {"status": "ok"}
