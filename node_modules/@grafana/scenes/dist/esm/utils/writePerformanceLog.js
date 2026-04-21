function writePerformanceLog(logger, message, ...rest) {
  let loggingEnabled = false;
  if (typeof window !== "undefined") {
    loggingEnabled = localStorage.getItem("grafana.debug.sceneProfiling") === "true";
  }
  if (loggingEnabled) {
    console.log(`${logger}: `, message, ...rest);
  }
}

export { writePerformanceLog };
//# sourceMappingURL=writePerformanceLog.js.map
