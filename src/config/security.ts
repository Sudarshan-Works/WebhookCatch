export const SECURITY_CONFIG = {
  MAX_REQUEST_BODY_SIZE: 1 * 1024 * 1024, // 1 MB
  MAX_SESSIONS_PER_IP_DAY: 5,
  TURNSTILE_TRIGGER_THRESHOLD: 3, // Requires challenge after 3 sessions
  MAX_REPLAYS_PER_SESSION: 50,
  CIRCUIT_BREAKER_ACTIVE: false, // If true, halts all webhook processing
};
