'use strict';

const { config } = require('./config');
const { createRunner } = require('./runner');
const { logger } = require('./utils/logger');

const runner = createRunner(config);

const args = process.argv.slice(2);
const isOnce = args.includes('--once') || config.runIntervalMinutes === 0;

if (isOnce) {
    runner.runSingleCycle().then(() => {
        process.exit(0);
    }).catch((err) => {
        logger.error(`Execution failed: ${err.message}`);
        process.exit(1);
    });
} else {
    runner.start().catch((err) => {
        logger.error(`Fatal worker error: ${err.message}`);
        process.exit(1);
    });
}
