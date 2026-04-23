from openai import OpenAI
import base64
import json
import os
import time
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

Identify device type using the decision rules below. Choose EXACTLY ONE from: PA, LNA, Filter, Switch, FEM, Balun, Splitter, RF-Connector.

CLASSIFICATION RULES (apply in order, pick the first match):

1. RF-Connector → physical connector (SMA, N-type, MMCX, U.FL, SMP, BNC, TNC, etc.)
2. Balun → balun, transformer, impedance converter (balanced-to-unbalanced)
3. Splitter → power divider, splitter, combiner, coupler
4. Filter → filter only (bandpass/lowpass/highpass/notch) with no active gain stage
5. FEM → Front-End Module. Use FEM if the device contains TWO OR MORE of: LNA, PA, TX path, RX path, bypass switch, integrated filter. Key indicators:
   - Has both TX and RX signal paths
   - Has LNA + bypass switch integrated together (e.g. "LNA with bypass", "receive module with switch")
   - Datasheet title/description contains "Front-End", "FEM", "RF Module", "Receive Module", "Tx/Rx Module"
   - Has separate TX_IN/TX_OUT and RX_IN/RX_OUT pins
   - NV5549, SKY65xx, RFFM series, QPAxxx with integrated switch → FEM
6. Switch → RF switch only, no active gain, has multiple RF ports switched by control pins (SPDT/SP3T/SP4T/etc.)
7. PA → power amplifier only, primarily amplifies in TX direction, high output power
8. LNA → low noise amplifier only, single signal path amplification, no integrated TX path or bypass switch logic

IMPORTANT: A device with "LNA + bypass switch" or "LNA + TX/RX switch" is FEM, not LNA.
A device with integrated filter + LNA is FEM, not LNA or Filter.

Return JSON in this exact format:
{
  "device_name": "...",
  "manufacturer": "...",
  "device_type": "PA|LNA|Filter|Switch|FEM|Balun|Splitter|RF-Connector",
  "package": "e.g. QFN-16, SOT-363, DFN-8",
  "package_size": "e.g. 3.0x3.0mm, 2.0x2.0x0.5mm, or null if not specified",
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
      "power_handling_dbm": "...",
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
- Switch: vcc_v, insertion_loss_db, insertion_loss_max_db, isolation_db, isolation_min_db, p1db_dbm, power_handling_dbm, ports
- FEM: vcc_v, icc_ma, tx_gain_db, tx_p1db_dbm, tx_psat_dbm, rx_gain_db, rx_nf_db, ports, switch_logic
  * tx_gain_db: TX path gain or PA gain (dB)
  * tx_p1db_dbm: TX path output P1dB (dBm)
  * tx_psat_dbm: TX path saturated output power (dBm)
  * rx_gain_db: RX path gain or LNA gain (dB)
  * rx_nf_db: RX path noise figure (dB)
  * If device has only RX path (LNA+switch FEM), leave tx_* as null and fill rx_gain_db, rx_nf_db
  * If device has only TX path (PA+switch FEM), leave rx_* as null and fill tx_gain_db, tx_p1db_dbm, tx_psat_dbm
- Balun: insertion_loss_db, return_loss_db, amplitude_balance_db, phase_balance_deg, impedance_ohm
  * amplitude_balance_db: amplitude imbalance between balanced ports (dB)
  * phase_balance_deg: phase imbalance between balanced ports (degrees)
  * impedance_ohm: impedance transformation ratio e.g. "50:100" or single value "50"
- Splitter: insertion_loss_db, return_loss_db, isolation_db, amplitude_balance_db, phase_balance_deg, power_handling_dbm, ports
- RF-Connector: insertion_loss_db, return_loss_db, vswr, impedance_ohm, power_handling_dbm

CRITICAL RULES FOR BANDS:
1. Each band entry MUST have ALL applicable parameters filled — do NOT leave parameters null just because they were already listed in a previous band.
2. If the datasheet has a specification table with multiple frequency bands/rows, create one band entry per row and copy the corresponding parameter values into each band.
3. If a parameter value is the same across all bands (e.g. Vcc=3.3V for all bands), repeat it in every band entry.
4. If a parameter varies by band (e.g. NF=0.8dB at Band1, NF=1.0dB at Band2), put the correct value in each band.
5. Never leave a band entry with only freq_min_mhz and freq_max_mhz filled — always populate all relevant parameters.

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


import re

FREQ_PATTERN = re.compile(
    r'(\d+\.?\d*)\s*[~\-–to]+\s*(\d+\.?\d*)\s*(GHz|MHz|ghz|mhz)', re.IGNORECASE
)

def _parse_freq_mhz(val: str) -> float:
    """Convert '2.4GHz' or '2400MHz' to MHz float."""
    m = re.match(r'(\d+\.?\d*)\s*(GHz|MHz)?', val.strip(), re.IGNORECASE)
    if not m:
        return 0.0
    v = float(m.group(1))
    unit = (m.group(2) or 'MHz').upper()
    return v * 1000 if unit == 'GHZ' else v


def _normalize_cell(c) -> str:
    if c is None:
        return ''
    return ' '.join(str(c).split())


def _restructure_spec_table(table: list[list]) -> str:
    """
    Detect "param × freq-band" style tables and convert to per-band rows.
    E.g.:
      Gain | 0.6~1GHz: 23.5 | 1.1~1.6GHz: 22 | ...
      NF   | 0.6~1GHz: 0.45 | 1.1~1.6GHz: 0.45 | ...
    → outputs structured text that AI can parse band-by-band.
    """
    if not table or len(table) < 2:
        return ''

    rows = [[_normalize_cell(c) for c in row] for row in table]

    # Detect freq-band columns: header row cells matching freq pattern
    header = rows[0]
    freq_col_indices = []
    freq_labels = []
    for ci, cell in enumerate(header):
        m = FREQ_PATTERN.search(cell)
        if m:
            freq_col_indices.append(ci)
            freq_labels.append(cell)

    # Also check second row for freq labels (some tables have freq in col 1)
    if not freq_col_indices and len(rows) > 1:
        for ri, row in enumerate(rows[1:], 1):
            for ci, cell in enumerate(row):
                if ci == 0:
                    continue
                if FREQ_PATTERN.search(cell):
                    freq_col_indices.append(ci)
                    freq_labels.append(cell)
            if freq_col_indices:
                break

    # Detect "param in col0, freq in col1, value in col2+" pattern
    # (vertical style: each data row is one freq range for one param)
    param_col = 0
    freq_col = -1
    value_col = -1
    if not freq_col_indices:
        for ri, row in enumerate(rows):
            for ci, cell in enumerate(row):
                if ci > 0 and FREQ_PATTERN.search(cell):
                    freq_col = ci
                    value_col = ci + 1 if ci + 1 < len(row) else ci
                    break
            if freq_col >= 0:
                break

    # --- Case 1: freq labels in header columns ---
    if freq_col_indices:
        lines = ['[Spec Table - per band]:']
        param_name = ''
        for row in rows[1:]:
            if not any(row):
                continue
            if row[0]:
                param_name = row[0]
            for ci, label in zip(freq_col_indices, freq_labels):
                val = row[ci] if ci < len(row) else ''
                if val and val not in ('-', '—', ''):
                    lines.append(f'  {label}: {param_name} = {val}')
        return '\n'.join(lines)

    # --- Case 2: vertical style (param | freq_range | value) ---
    if freq_col >= 0:
        lines = ['[Spec Table - vertical style]:']
        param_name = ''
        for row in rows:
            if not any(row):
                continue
            if row[param_col]:
                param_name = row[param_col]
            freq_str = row[freq_col] if freq_col < len(row) else ''
            val_str = row[value_col] if value_col < len(row) else ''
            if FREQ_PATTERN.search(freq_str) and val_str and val_str not in ('-', '—'):
                lines.append(f'  {freq_str}: {param_name} = {val_str}')
        return '\n'.join(lines)

    # --- Fallback: plain join ---
    lines = []
    for row in rows:
        cleaned = [c for c in row if c]
        if cleaned:
            lines.append(' | '.join(cleaned))
    return '\n'.join(lines)


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    text_parts = []
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages[:15]:
            text = page.extract_text()
            if text:
                text_parts.append(text)
            tables = page.extract_tables()
            for table in tables:
                restructured = _restructure_spec_table(table)
                if restructured:
                    text_parts.append(restructured)
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

    last_err = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="moonshot-v1-32k-vision-preview",
                max_tokens=3000,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": content},
                ],
            )
            break
        except Exception as e:
            last_err = e
            if "429" in str(e) or "overloaded" in str(e).lower():
                time.sleep(15 * (attempt + 1))
            else:
                raise
    else:
        raise last_err

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)
