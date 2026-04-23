from openai import OpenAI
import base64
import json
import os
import fitz  # PyMuPDF
import pdfplumber
from io import BytesIO
from PIL import Image

client = OpenAI(
    api_key=os.getenv("MOONSHOT_API_KEY", "placeholder"),
    base_url="https://api.moonshot.cn/v1",
)

SYSTEM_PROMPT = """You are an expert RF/microwave engineer. Extract specifications from RF component datasheets.
Always respond with valid JSON only, no extra text.
For values read from graphs/charts, add "~" prefix (e.g. "~2.1").
If a value cannot be found, use null.
Frequencies in MHz."""

EXTRACT_PROMPT = """Extract ALL specifications from this RF component datasheet across ALL supported frequency bands.

Identify device type: PA, LNA, Filter, Switch, FEM, Balun, Splitter, or RF-Connector.

- PA: Power Amplifier
- LNA: Low Noise Amplifier
- Filter: bandpass/lowpass/highpass/notch filter
- Switch: RF switch (SPDT, SP3T, SP4T, etc.)
- FEM: Front-End Module (integrates PA+LNA+Switch+Filter)
- Balun: Balun / transformer
- Splitter: power divider / splitter / combiner
- RF-Connector: SMA, N-type, MMCX, U.FL, etc.

Return JSON in this exact format:
{
  "device_name": "...",
  "manufacturer": "...",
  "device_type": "PA|LNA|Filter|Switch|FEM|Balun|Splitter|RF-Connector",
  "package": "e.g. QFN-16, SOT-363, DFN-8",
  "pin_count": number or null,
  "enable_level": "Active High | Active Low | null",
  "switch_logic": [
    {"ctrl": "V_ctrl=0V", "path": "RFC-RF1"},
    {"ctrl": "V_ctrl=3.3V", "path": "RFC-RF2"}
  ],
  "freq_min_mhz": number,
  "freq_max_mhz": number,
  "bands": [
    {
      "freq_min_mhz": number,
      "freq_max_mhz": number,
      "band_name": "e.g. n77, n78, Band 1, or null",
      "vcc_v": "...",
      "icc_ma": "...",
      "gain_db": "...",
      "gain_min_db": "...",
      "p1db_dbm": "...",
      "psat_dbm": "...",
      "pae_percent": "...",
      "nf_db": "...",
      "nf_max_db": "...",
      "iip3_dbm": "...",
      "op1db_dbm": "...",
      "oip3_dbm": "...",
      "s11_db": "...",
      "s22_db": "...",
      "insertion_loss_db": "...",
      "insertion_loss_max_db": "...",
      "rejection_db": "...",
      "return_loss_db": "...",
      "isolation_db": "...",
      "isolation_min_db": "...",
      "ports": "...",
      "vswr": "...",
      "impedance_ohm": "...",
      "amplitude_balance_db": "...",
      "phase_balance_deg": "...",
      "power_handling_dbm": "...",
      "tx_gain_db": "...",
      "tx_p1db_dbm": "...",
      "tx_psat_dbm": "...",
      "rx_gain_db": "...",
      "rx_nf_db": "..."
    }
  ],
  "notes": "..."
}

Field usage by device type:
- PA: vcc_v, icc_ma, gain_db, gain_min_db, p1db_dbm, psat_dbm, pae_percent, s11_db, s22_db
- LNA: vcc_v, icc_ma, gain_db, gain_min_db, nf_db, nf_max_db, iip3_dbm, op1db_dbm, oip3_dbm, s11_db
- Filter: insertion_loss_db, insertion_loss_max_db, rejection_db, return_loss_db
- Switch: vcc_v, insertion_loss_db, insertion_loss_max_db, isolation_db, isolation_min_db, p1db_dbm, ports
- FEM: tx_gain_db, tx_p1db_dbm, tx_psat_dbm, rx_gain_db, rx_nf_db, vcc_v, icc_ma, ports, switch_logic
- Balun: insertion_loss_db, return_loss_db, amplitude_balance_db, phase_balance_deg, impedance_ohm
- Splitter: insertion_loss_db, return_loss_db, isolation_db, amplitude_balance_db, phase_balance_deg, power_handling_dbm, ports
- RF-Connector: insertion_loss_db, return_loss_db, vswr, impedance_ohm, power_handling_dbm

If the device only has one frequency range, put one entry in bands.
For switch_logic, only fill if device has control pins (LNA bypass switch, RF switch, or FEM TX/RX switch).
For enable_level, only fill if device has enable/shutdown pin."""


def pdf_to_images(pdf_bytes: bytes, max_pages: int = 15) -> list[str]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        mat = fitz.Matrix(2.0, 2.0)
        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        buf = BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.standard_b64encode(buf.getvalue()).decode("utf-8")
        images.append(b64)
    doc.close()
    return images


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    text_parts = []
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages[:15]:
            text = page.extract_text()
            if text:
                text_parts.append(text)
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if row:
                        text_parts.append(" | ".join(str(c) for c in row if c))
    return "\n".join(text_parts)


def extract_specs(pdf_bytes: bytes) -> dict:
    images = pdf_to_images(pdf_bytes)
    text_content = extract_text_from_pdf(pdf_bytes)

    content = []

    if text_content.strip():
        content.append({
            "type": "text",
            "text": f"Extracted text from datasheet:\n{text_content[:8000]}"
        })

    for i, img_b64 in enumerate(images[:4]):
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{img_b64}"}
        })

    content.append({"type": "text", "text": EXTRACT_PROMPT})

    response = client.chat.completions.create(
        model="moonshot-v1-32k-vision-preview",
        max_tokens=3000,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)
