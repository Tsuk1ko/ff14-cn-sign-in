class FF14CSIError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FF14CSIError';
  }
}

module.exports = FF14CSIError;
