import { describe, expect, it } from "vitest";
import { checkUrlSafety, isHostnameBlockedByName, isIpBlocked } from "../../src/lib/safety/ssrf";

describe("isIpBlocked", () => {
  it("blocks loopback", () => {
    expect(isIpBlocked("127.0.0.1")).toBe(true);
    expect(isIpBlocked("::1")).toBe(true);
  });

  it("blocks private ranges", () => {
    expect(isIpBlocked("10.0.0.5")).toBe(true);
    expect(isIpBlocked("172.16.0.1")).toBe(true);
    expect(isIpBlocked("172.31.255.255")).toBe(true);
    expect(isIpBlocked("192.168.1.1")).toBe(true);
  });

  it("does not block adjacent public ranges that look similar", () => {
    expect(isIpBlocked("172.32.0.1")).toBe(false);
    expect(isIpBlocked("172.15.255.255")).toBe(false);
  });

  it("blocks link-local, including the cloud metadata address", () => {
    expect(isIpBlocked("169.254.169.254")).toBe(true);
    expect(isIpBlocked("169.254.0.1")).toBe(true);
  });

  it("blocks CGNAT 100.64/10", () => {
    expect(isIpBlocked("100.64.0.1")).toBe(true);
    expect(isIpBlocked("100.100.0.1")).toBe(true);
    expect(isIpBlocked("100.128.0.1")).toBe(false);
  });

  it("blocks IPv6 link-local and unique-local ranges", () => {
    expect(isIpBlocked("fe80::1")).toBe(true);
    expect(isIpBlocked("fc00::1")).toBe(true);
    expect(isIpBlocked("fd12:3456::1")).toBe(true);
  });

  it("blocks an IPv4-mapped IPv6 loopback", () => {
    expect(isIpBlocked("::ffff:127.0.0.1")).toBe(true);
  });

  it("allows an ordinary public IP", () => {
    expect(isIpBlocked("93.184.216.34")).toBe(false);
  });
});

describe("isHostnameBlockedByName", () => {
  it("blocks localhost and .internal/.local suffixes", () => {
    expect(isHostnameBlockedByName("localhost")).toBe(true);
    expect(isHostnameBlockedByName("LOCALHOST")).toBe(true);
    expect(isHostnameBlockedByName("router.local")).toBe(true);
    expect(isHostnameBlockedByName("service.internal")).toBe(true);
  });

  it("allows an ordinary domain", () => {
    expect(isHostnameBlockedByName("developer.example.com")).toBe(false);
  });
});

describe("checkUrlSafety (hostile URLs)", () => {
  it("rejects a non-http(s) scheme", async () => {
    expect((await checkUrlSafety("ftp://example.com/file")).ok).toBe(false);
    expect((await checkUrlSafety("file:///etc/passwd")).ok).toBe(false);
  });

  it("rejects an invalid URL", async () => {
    expect((await checkUrlSafety("not a url")).ok).toBe(false);
  });

  it("rejects credentials embedded in the URL", async () => {
    expect((await checkUrlSafety("https://user:pass@93.184.216.34/")).ok).toBe(false);
  });

  it("rejects a non-80/443 port", async () => {
    expect((await checkUrlSafety("https://93.184.216.34:8080/")).ok).toBe(false);
  });

  it("rejects an IP-literal loopback URL", async () => {
    expect((await checkUrlSafety("http://127.0.0.1/")).ok).toBe(false);
  });

  it("rejects the cloud metadata IP", async () => {
    expect((await checkUrlSafety("http://169.254.169.254/latest/meta-data/")).ok).toBe(false);
  });

  it("rejects an IP-literal private-range URL", async () => {
    expect((await checkUrlSafety("http://10.0.0.1/")).ok).toBe(false);
    expect((await checkUrlSafety("http://192.168.0.1/")).ok).toBe(false);
  });

  it("rejects an IPv6 loopback URL", async () => {
    expect((await checkUrlSafety("http://[::1]/")).ok).toBe(false);
  });

  it("rejects localhost by name", async () => {
    expect((await checkUrlSafety("http://localhost/")).ok).toBe(false);
    expect((await checkUrlSafety("http://localhost:8080/")).ok).toBe(false);
  });

  it("rejects .internal and .local hostnames", async () => {
    expect((await checkUrlSafety("http://router.local/")).ok).toBe(false);
    expect((await checkUrlSafety("http://service.internal/")).ok).toBe(false);
  });

  it("allows an ordinary public IP-literal https URL", async () => {
    expect((await checkUrlSafety("https://93.184.216.34/")).ok).toBe(true);
  });
});
