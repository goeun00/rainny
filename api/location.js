module.exports = async function handler(req, res) {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const restApiKey = process.env.KAKAO_REST_API_KEY;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        message: "위치 정보가 올바르지 않아요.",
      });
    }

    if (!restApiKey) {
      return res.status(500).json({
        message: "KAKAO_REST_API_KEY가 설정되지 않았어요.",
      });
    }

    const params = new URLSearchParams({
      x: String(lon),
      y: String(lat),
      input_coord: "WGS84",
    });

    const response = await fetch("https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?" + params.toString(), {
      headers: {
        Authorization: "KakaoAK " + restApiKey,
      },
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        message: "카카오 위치 API 오류",
        status: response.status,
        detail: text,
      });
    }

    const data = JSON.parse(text);

    // H = 행정동
    const region = data.documents.find(function (item) {
      return item.region_type === "H";
    });

    if (!region) {
      throw new Error("행정구역 정보를 찾지 못했어요.");
    }

    return res.status(200).json({
      region1: region.region_1depth_name,
      region2: region.region_2depth_name,
      region3: region.region_3depth_name,
      address: region.address_name,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: error.message || "위치를 불러오지 못했어요.",
    });
  }
};
