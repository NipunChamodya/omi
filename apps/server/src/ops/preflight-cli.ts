import 'dotenv/config';
import { parseConfig } from '../config.js';
import { deploymentChecks } from './preflight.js';
try {
  const checks = deploymentChecks(parseConfig(process.env));
  const passed = checks.every((check) => check.passed);
  console.log(
    JSON.stringify(
      {
        configurationPassed: passed,
        publicVerification: 'not-performed',
        checks,
      },
      null,
      2,
    ),
  );
  if (!passed) process.exitCode = 1;
} catch {
  console.error(
    'Deployment configuration is invalid. Review documented settings; no secret values are printed.',
  );
  process.exitCode = 1;
}
