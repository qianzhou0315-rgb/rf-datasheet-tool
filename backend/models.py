from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.sql import func
from database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    manufacturer = Column(String(200))
    device_type = Column(String(50))  # PA, LNA, Filter, Switch, FEM, Balun, Splitter, RF-Connector
    freq_min_mhz = Column(Float)   # overall min freq
    freq_max_mhz = Column(Float)   # overall max freq
    package = Column(String(100))  # e.g. QFN-16
    package_size = Column(String(100))  # e.g. 3.0x3.0mm
    pin_count = Column(Integer)
    enable_level = Column(String(50))   # e.g. "Active High", "Active Low"
    switch_logic = Column(JSON)    # e.g. [{"ctrl": "V_ctrl=0", "path": "RF1-RF3"}]
    bands = Column(JSON)           # list of per-band spec dicts
    pdf_filename = Column(String(500))
    pdf_url = Column(String(1000))
    raw_specs = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
