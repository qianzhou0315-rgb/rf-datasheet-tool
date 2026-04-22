from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.sql import func
from database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    manufacturer = Column(String(200))
    device_type = Column(String(50))  # PA, LNA, Filter, Switch
    freq_min_mhz = Column(Float)
    freq_max_mhz = Column(Float)
    pdf_filename = Column(String(500))
    pdf_url = Column(String(1000))
    raw_specs = Column(JSON)  # all extracted specs as JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PASpecs(Base):
    __tablename__ = "pa_specs"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, index=True)
    vcc_v = Column(Float)
    icc_ma = Column(Float)
    gain_db = Column(Float)
    gain_min_db = Column(Float)
    p1db_dbm = Column(Float)
    psat_dbm = Column(Float)
    pae_percent = Column(Float)
    s11_db = Column(Float)
    s22_db = Column(Float)
    notes = Column(Text)


class LNASpecs(Base):
    __tablename__ = "lna_specs"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, index=True)
    vcc_v = Column(Float)
    icc_ma = Column(Float)
    gain_db = Column(Float)
    gain_min_db = Column(Float)
    nf_db = Column(Float)
    nf_max_db = Column(Float)
    iip3_dbm = Column(Float)
    s11_db = Column(Float)
    notes = Column(Text)


class FilterSpecs(Base):
    __tablename__ = "filter_specs"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, index=True)
    insertion_loss_db = Column(Float)
    insertion_loss_max_db = Column(Float)
    rejection_db = Column(Float)
    return_loss_db = Column(Float)
    package = Column(String(100))
    notes = Column(Text)


class SwitchSpecs(Base):
    __tablename__ = "switch_specs"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, index=True)
    vcc_v = Column(Float)
    insertion_loss_db = Column(Float)
    insertion_loss_max_db = Column(Float)
    isolation_db = Column(Float)
    isolation_min_db = Column(Float)
    p1db_dbm = Column(Float)
    ports = Column(String(50))
    notes = Column(Text)
