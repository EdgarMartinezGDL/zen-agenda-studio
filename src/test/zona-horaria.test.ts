import { afterEach, describe, expect, it, vi } from "vitest";
import { aInstante, diasEntre, fmtFecha, hhmmEnZona, hoyEnZona, rangoDelDia, sumarDias, ymdEnZona, zonaClinica, zonaDeSede, ZONAS_HORARIAS, ZONA_CENTRO } from "@/lib/zona-horaria";

afterEach(() => vi.useRealTimers());
describe("Explicit clinic and location timezones", () => {
  it("offers the seven supplied Mexican timezone values", () => {
    expect(ZONAS_HORARIAS.map(z => z.value)).toEqual(["America/Mexico_City", "America/Mazatlan", "America/Hermosillo", "America/Cancun", "America/Tijuana", "America/Ciudad_Juarez", "America/Matamoros"]);
  });
  it("uses Centro when locations differ or are missing", () => {
    expect(zonaClinica([])).toBe(ZONA_CENTRO);
    expect(zonaClinica([{ timezone: "America/Cancun" }, { timezone: "America/Tijuana" }])).toBe(ZONA_CENTRO);
  });
  it("uses a shared clinic zone and the selected location zone", () => {
    const locations = [{ id: "a", timezone: "America/Cancun" }, { id: "b", timezone: "America/Cancun" }];
    expect(zonaClinica(locations)).toBe("America/Cancun");
    expect(zonaDeSede(locations, "a")).toBe("America/Cancun");
    expect(zonaDeSede(locations, "missing")).toBe("America/Cancun");
  });
  it("uses October 30 in Mexico City at the supplied October 31 UTC instant", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-31T04:44:00Z"));
    expect(hoyEnZona(ZONA_CENTRO)).toBe("2026-10-30");
    expect(hhmmEnZona(new Date(), ZONA_CENTRO)).toBe("22:44");
  });
  it.each([["America/Mexico_City", "2026-10-30T15:00:00.000Z"], ["America/Cancun", "2026-10-30T14:00:00.000Z"], ["America/Hermosillo", "2026-10-30T16:00:00.000Z"]])("captures 09:00 in %s as the correct instant", (zona, iso) => {
    const instant = aInstante("2026-10-30", "09:00", zona);
    expect(instant.toISOString()).toBe(iso);
    expect(ymdEnZona(instant, zona)).toBe("2026-10-30");
    expect(hhmmEnZona(instant, zona)).toBe("09:00");
  });
  it("filters the full Mexico City day including its last millisecond", () => {
    expect(rangoDelDia("2026-10-30", ZONA_CENTRO)).toEqual({ from: "2026-10-30T06:00:00.000Z", to: "2026-10-31T05:59:59.999Z" });
  });
  it("uses a 23-hour Tijuana day at the spring clock change", () => {
    expect(rangoDelDia("2026-03-08", "America/Tijuana")).toEqual({ from: "2026-03-08T08:00:00.000Z", to: "2026-03-09T06:59:59.999Z" });
  });
  it("uses a 25-hour Tijuana day at the autumn clock change", () => {
    expect(rangoDelDia("2026-11-01", "America/Tijuana")).toEqual({ from: "2026-11-01T07:00:00.000Z", to: "2026-11-02T07:59:59.999Z" });
  });
  it("keeps calendar arithmetic across month and year boundaries", () => {
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(diasEntre("2026-10-30", "2026-11-01")).toBe(2);
    expect(fmtFecha("2026-10-30", { day: "2-digit", month: "2-digit", year: "numeric" })).toBe("30/10/2026");
  });
});