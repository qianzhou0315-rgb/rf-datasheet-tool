import boto3
import os
import uuid
from botocore.config import Config


def get_cos_client():
    region = os.getenv("COS_REGION", "ap-guangzhou")
    return boto3.client(
        "s3",
        endpoint_url=f"https://cos.{region}.myqcloud.com",
        aws_access_key_id=os.getenv("COS_SECRET_ID"),
        aws_secret_access_key=os.getenv("COS_SECRET_KEY"),
        config=Config(signature_version="s3v4"),
        region_name=region,
    )


BUCKET = os.getenv("COS_BUCKET_NAME", "rf-datasheets")
REGION = os.getenv("COS_REGION", "ap-guangzhou")


def upload_pdf(file_bytes: bytes, original_filename: str) -> tuple[str, str]:
    """Upload PDF to COS, return (stored_filename, public_url)"""
    ext = original_filename.rsplit(".", 1)[-1].lower()
    stored_name = f"{uuid.uuid4()}.{ext}"

    client = get_cos_client()
    client.put_object(
        Bucket=BUCKET,
        Key=stored_name,
        Body=file_bytes,
        ContentType="application/pdf",
    )

    public_url = f"https://{BUCKET}.cos.{REGION}.myqcloud.com/{stored_name}"
    return stored_name, public_url


def get_pdf_bytes(stored_filename: str) -> bytes:
    """Download PDF from COS"""
    client = get_cos_client()
    response = client.get_object(Bucket=BUCKET, Key=stored_filename)
    return response["Body"].read()


def delete_pdf(stored_filename: str):
    client = get_cos_client()
    client.delete_object(Bucket=BUCKET, Key=stored_filename)
