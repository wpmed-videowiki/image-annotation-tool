export class NotLinkedError extends Error {
  constructor(provider) {
    super(`provider_not_linked:${provider}`);
    this.name = "NotLinkedError";
    this.provider = provider;
  }
}

export class ReauthRequiredError extends Error {
  constructor(provider) {
    super(`reauth_required:${provider}`);
    this.name = "ReauthRequiredError";
    this.provider = provider;
  }
}
