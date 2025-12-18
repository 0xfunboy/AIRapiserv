import { DirectoryAPIProvider, DirectoryToken } from '@airapiserv/core';

export abstract class BaseDirectoryProvider implements DirectoryAPIProvider {
  abstract readonly name: string;
  abstract fetchTokens(): Promise<DirectoryToken[]>;

  protected normalizeSymbol(symbol?: string) {
    return symbol ? symbol.trim().toUpperCase() : '';
  }
  protected normalizeAddress(addr?: string) {
    return addr ? addr.trim().toLowerCase() : '';
  }
}
