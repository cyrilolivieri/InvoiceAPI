"""
PaddleOCR HTTP Service
Exposes POST /ocr endpoint for InvoiceAPI.
Accepts: multipart/form-data with field "file" (image or PDF)
Returns: JSON { "text": "...", "success": true/false }
"""
import io
import tempfile
import os
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
from PIL import Image
import paddle
from paddleocr import PaddleOCR

paddle.enable_static = False

# Initialize OCR once at startup (downloads models on first run)
print("Initializing PaddleOCR (downloading models if needed)...")
ocr = PaddleOCR(
    use_angle_cls=True,
    lang="en",
    use_gpu=False,
    show_log=False,
    rec_algorithm="CRNN",
)
print("PaddleOCR ready!")

app = FastAPI(title="InvoiceAPI OCR Service")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ocr")
async def extract_text(file: UploadFile = File(...)):
    try:
        contents = await file.read()

        # Handle PDF — convert first page to image
        if file.content_type == "application/pdf" or file.filename.lower().endswith(".pdf"):
            try:
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(contents))
                if reader.pages:
                    page = reader.pages[0]
                    img_data = page.images[0].if_image_native_image
                    if img_data is None:
                        # Render page to image via pypdf
                        from pypdf import PdfImageReader
                        # Fallback: use first image extracted from PDF
                        for img_obj in page.images:
                            img_bytes = img_obj.data
                            img = Image.open(io.BytesIO(img_bytes))
                            img = img.convert("RGB")
                            tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
                            img.save(tmp.name)
                            tmp_path = tmp.name
                            break
                        else:
                            raise HTTPException(status_code=400, detail="No images found in PDF")
                    else:
                        img = img_data
                        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
                        img.save(tmp.name)
                        tmp_path = tmp.name
                else:
                    raise HTTPException(status_code=400, detail="PDF has no pages")
            except ImportError:
                raise HTTPException(status_code=400, detail="pypdf not installed — convert PDF to image first")
        else:
            # Image — save to temp file
            img = Image.open(io.BytesIO(contents))
            img = img.convert("RGB")  # Ensure RGB
            tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
            img.save(tmp.name)
            tmp_path = tmp.name

        try:
            # Run PaddleOCR
            result = ocr.ocr(tmp_path, cls=True)
            lines = []
            if result and result[0]:
                for line in result[0]:
                    if line and len(line) >= 2:
                        text = line[1][0] if isinstance(line[1], (list, tuple)) else line[1]
                        lines.append(text)
            extracted_text = "\n".join(lines)
            return JSONResponse({"text": extracted_text, "success": True})
        finally:
            os.unlink(tmp_path)

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
