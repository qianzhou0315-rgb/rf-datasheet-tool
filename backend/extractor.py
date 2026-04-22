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

SYSTEM_PROMPT = """You are an expert RF/microwave engineer. Your job is to extract specifications from RF component datasheets.
You will receive pages from a datasheet (text and images) and must extract key specifications.
Always respond with valid JSON only, no extra text.
For values read from graphs/charts, add a "~" prefix to indicate approximate value (e.g. "~2.1").
If a value cannot be found, use null.
Frequencies should be in MHz."""

EXTRACT_PROMPT = """Extract specifications from this RF component datasheet.

First identify the device type: PA (Power Amplifier), LNA (Low Noise Amplifier), Filter, or Switch.
Then extract all relevant specifications for the target frequency band.

Target frequency band: {freq_min} MHz to {freq_max} MHz

Return JSON in this exact format:
{{
  "device_name": "...",
  "manufacturer": "...",
  "device_type": "PA|LNA|Filter|Switch",
  "freq_min_mhz": number,
  "freq_max_mhz": number,
  "specs": {{
    // For PA:
    "vcc_v": "...",
    "icc_ma": "...",
    "gain_db": "...",
    "gain_min_db": "...",
    "p1db_dbm": "...",
    "psat_dbm": "...",
    "pae_percent": "...",
    "s11_db": "...",
    "s22_db": "...",

    // For LNA:
    "vcc_v": "...",
    "icc_ma": "...",
    "gain_db": "...",
    "gain_min_db": "...",
    "nf_db": "...",
    "nf_max_db": "...",
    "iip3_dbm": "...",
    "s11_db": "...",

    // For Filter:
    "insertion_loss_db": "...",
    "insertion_loss_max_db": "...",
    "rejection_db": "...",
    "return_loss_db": "...",
    "package": "...",

    // For Switch:
    "vcc_v": "...",
    "insertion_loss_db": "...",
    "insertion_loss_max_db": "...",
    "isolation_db": "...",
    "isolation_min_db": "...",
    "p1db_dbm": "...",
    "ports": "..."
  }},
  "notes": "any important notes or caveats"
}}"""


def pdf_to_images(pdf_bytes: bytes, max_pages: int = 15) -> list[str]:
    """Convert PDF pages to base64 PNG images"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better quality
        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        buf = BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.standard_b64encode(buf.getvalue()).decode("utf-8")
        images.append(b64)
    doc.close()
    return images


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text content from PDF"""
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


def extract_specs(pdf_bytes: bytes, freq_min: float, freq_max: float) -> dict:
    """Main extraction function - calls SiliconFlow Claude with PDF content"""
    images = pdf_to_images(pdf_bytes)
    text_content = extract_text_from_pdf(pdf_bytes)

    prompt = EXTRACT_PROMPT.format(freq_min=freq_min, freq_max=freq_max)

    content = []

    # Add text content
    if text_content.strip():
        content.append({
            "type": "text",
            "text": f"Extracted text from datasheet:\n{text_content[:8000]}"
        })

    # Add page images (up to 4 pages to control token usage)
    for i, img_b64 in enumerate(images[:4]):
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/png;base64,{img_b64}",
            }
        })

    content.append({"type": "text", "text": prompt})

    response = client.chat.completions.create(
        model="moonshot-v1-32k-vision-preview",
        max_tokens=2000,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
    )

    raw = response.choices[0].message.content.strip()
    # Strip markdown code blocks if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)
