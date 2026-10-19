import { byId } from "../utils/dom";

export function readCalibrationInputs(): { weight: number; fill: number } {
  return {
    weight: Number((byId<HTMLInputElement>("calib-weight")).value),
    fill: Number((byId<HTMLInputElement>("calib-fill")).value),
  };
}

export function setCalibrationStatus(text: string): void {
  byId("calib-status").textContent = text;
}
