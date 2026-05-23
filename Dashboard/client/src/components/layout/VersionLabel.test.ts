import { describe, expect, it } from 'vitest';

import { formatVersionLabel } from './VersionLabel';

describe('formatVersionLabel', () => {
  it('includes client, server, and database schema versions', () => {
    expect(
      formatVersionLabel({
        clientVersion: '1.1.0',
        serverVersion: '1.1.0',
        databaseSchemaVersion: 1,
        databaseSchemaTargetVersion: 1,
      })
    ).toBe('Version: 1.1.0 · DB schema: 1');
  });

  it('shows both versions when client and server differ', () => {
    expect(
      formatVersionLabel({
        clientVersion: '1.1.0',
        serverVersion: '1.2.0',
        databaseSchemaVersion: 1,
        databaseSchemaTargetVersion: 1,
      })
    ).toBe('Version: 1.1.0/1.2.0 · DB schema: 1');
  });

  it('marks schema drift when the database version differs from the target', () => {
    expect(
      formatVersionLabel({
        clientVersion: '1.1.0',
        serverVersion: '1.1.0',
        databaseSchemaVersion: 0,
        databaseSchemaTargetVersion: 1,
      })
    ).toBe('Version: 1.1.0 · DB schema: 0 -> 1');
  });
});
