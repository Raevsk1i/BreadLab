import { byId } from "../utils/dom";

export function syncSettings(machineId: string, largeSteps: boolean): void {
  byId<HTMLSelectElement>("set-machine").value = machineId;
  byId<HTMLInputElement>("set-large").checked = largeSteps;
  document.body.classList.toggle("large-steps", largeSteps);
}
