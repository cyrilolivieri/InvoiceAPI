FROM python:3.11-slim

WORKDIR /app

# Install curl (for healthcheck) + PaddlePaddle CPU + PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip --no-cache-dir install \
    paddlepaddle==3.0.0b2 \
    paddleocr==2.9.1 \
    fastapi==0.115.0 \
    uvicorn==0.30.0 \
    python-multipart==0.0.9 \
    pypdf==5.1.0

COPY ocr_service.py .

EXPOSE 5000

# Download PP-OCRv5 models on first start (cached in volume)
CMD ["python", "ocr_service.py"]
