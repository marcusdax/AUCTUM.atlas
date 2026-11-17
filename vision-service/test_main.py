import tempfile
from pathlib import Path
from PIL import Image
from main import _pixel_metrics, analyze_roof, AnalyzeRequest, estimate_roof, PhotogrammetryRequest


def test_real_image_analysis():
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        p = Path(tf.name)
    img = Image.new("RGB", (64, 64), color=(120, 120, 120))
    img.putpixel((20, 20), (15, 15, 15))
    img.save(p)
    try:
        res = _pixel_metrics(p)
        assert res["width"] == 64
        assert res["height"] == 64
        assert res["fileBytes"] > 0
        photo_out = analyze_roof(AnalyzeRequest(fileName="hail_sample.png", notes="hail bruise"))
        assert photo_out["damageClass"] == "HAIL_IMPACT"
        odm = estimate_roof(PhotogrammetryRequest(fileUrls=["/uploads/a.jpg", "/uploads/b.jpg"]))
        assert odm["estimatedSquares"] > 20
    finally:
        p.unlink(missing_ok=True)
