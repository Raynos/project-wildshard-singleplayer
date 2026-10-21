// oxlint-disable-next-line import/no-unassigned-import -- standalone CLI installs identity before the calibration module evaluates
import './identity';
import { startPageServices } from './pageServices';

startPageServices();
// Separate from the game entry: no level, renderer, title or Developer tool is installed here.
// WASM-HOST H0: the shipped decision modules reach the engine's Wasm rows as data (bytes and IO dimensions).
void import('@wildshard/engine/calibrate/entry').then((module) => module.enterCalibration(async (owner) =>
  (await import('@wildshard/game/shardfile/calibrationScripts')).calibrationScripts(owner)));
