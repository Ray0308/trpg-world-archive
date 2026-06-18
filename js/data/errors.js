/**
 * データ読み込みエラー
 */
class ArchiveLoadError extends Error {
  constructor(title, message, details = {}) {
    super(message);
    this.name = 'ArchiveLoadError';
    this.title = title;
    this.details = details;
  }
}

window.ArchiveLoadError = ArchiveLoadError;
