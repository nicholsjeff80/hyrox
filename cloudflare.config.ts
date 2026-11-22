export default {
  worker: {
    name: "hyrox",
    compatibilityDate: "2026-11-21",
    workersDev: true,
    previewUrls: false,
    observability: {
      enabled: true,
      logs: { enabled: true },
      traces: { enabled: true, headSamplingRate: 0.01 },
    },
  },
};
