import { createMachine } from 'xstate';

export const documentIngestionMachine = createMachine({
  id: 'documentIngestion',
  initial: 'awaitingScan',
  states: {
    awaitingScan: {
      on: {
        FILE_SELECTED: 'extractingData',
      },
    },
    extractingData: {
      on: {
        EXTRACTION_READY: 'pendingUserValidation',
        EXTRACTION_FAILED: 'awaitingScan',
      },
    },
    pendingUserValidation: {
      on: {
        CONFIRM_SAVE: 'saving',
        REUPLOAD: 'awaitingScan',
      },
    },
    saving: {
      on: {
        SAVE_SUCCESS: 'savedSuccessfully',
        SAVE_FAILED: 'pendingUserValidation',
      },
    },
    savedSuccessfully: {
      on: {
        RESET: 'awaitingScan',
      },
    },
  },
});
