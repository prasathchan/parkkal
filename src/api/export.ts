export function exportPatients(): void {
  window.location.href = "/api/export?type=patients";
}

export function exportBilling(): void {
  window.location.href = "/api/export?type=billing";
}
