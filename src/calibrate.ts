// oxlint-disable-next-line import/no-unassigned-import -- standalone CLI installs identity before the calibration module evaluates
import './identity';
import { startPageServices } from './pageServices';

startPageServices();
// Separate from the game entry: no level, renderer, title or Developer tool is installed here.
void import('./engine/calibrate/entry').then((module) => module.enterCalibration());
