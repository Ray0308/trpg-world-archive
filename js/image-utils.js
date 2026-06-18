/**
 * 外部画像 URL の解決（Google Drive 対応）
 */
window.ImageUtils = (function () {
  function extractGoogleDriveId(url) {
    if (!url) return null;
    const patterns = [
      /[?&]id=([a-zA-Z0-9_-]+)/,
      /\/file\/d\/([a-zA-Z0-9_-]+)/,
      /\/d\/([a-zA-Z0-9_-]+)/
    ];
    for (const pattern of patterns) {
      const match = String(url).match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  function googleDriveCandidates(fileId) {
    return [
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
      `https://drive.google.com/uc?export=view&id=${fileId}`,
      `https://drive.google.com/uc?export=download&id=${fileId}`,
      `https://lh3.googleusercontent.com/d/${fileId}=w1000`
    ];
  }

  function resolveImageUrl(url) {
    if (!url || String(url).startsWith('data:')) return { src: url || '', fallbacks: [] };
    const driveId = extractGoogleDriveId(url);
    if (driveId) {
      const candidates = googleDriveCandidates(driveId);
      return { src: candidates[0], fallbacks: candidates.slice(1) };
    }
    return { src: url, fallbacks: [] };
  }

  function buildImgAttrs(url, svgFallback) {
    if (!url) return { src: svgFallback, fallbacks: [] };
    const { src, fallbacks } = resolveImageUrl(url);
    const chain = [...fallbacks, svgFallback].filter((item, i, arr) => item && arr.indexOf(item) === i);
    return { src, fallbacks: chain.filter(f => f !== src) };
  }

  return {
    extractGoogleDriveId,
    resolveImageUrl,
    buildImgAttrs
  };
})();
