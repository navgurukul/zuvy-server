import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { and, asc, count, eq, ilike, like, or, sql, SQL } from 'drizzle-orm';
import { db } from 'src/db';
import { zuvySchools } from 'drizzle/schema';
import { AuthService } from 'src/auth/auth.service';
import {
  RowError,
  SchoolCsvError,
  parseSchoolCsv,
  placeKey,
} from './school-rows';
import {
  UPSERT_BATCH_SIZE,
  loadPlaceNames,
  upsertSchools,
} from './school-store';

const MAX_ERRORS_RETURNED = 100;
const MAX_SEARCH_WORDS = 5;
// States and cities change only when the list is loaded again.
const PLACES_CACHE_MS = 10 * 60 * 1000;

interface PlaceIndex {
  states: string[];
  /** placeKey(state) -> spelling in the list */
  stateNames: Map<string, string>;
  /** spelling of a state -> its cities, A to Z */
  cities: Map<string, string[]>;
  /** placeKey(state)|placeKey(city) -> spelling in the list */
  cityNames: Map<string, string>;
  loadedAt: number;
}

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);
  private places: PlaceIndex | null = null;
  private placesLoading: Promise<PlaceIndex> | null = null;

  constructor(private readonly authService: AuthService) {}

  /** States that have at least one active school, A to Z. */
  async listStates() {
    const places = await this.placeIndex();
    return { status: 'success', data: places.states };
  }

  /** Cities (UDISE districts) of a state, A to Z. Any letter case works. */
  async listCities(state: string) {
    const places = await this.placeIndex();
    const stateName = places.stateNames.get(placeKey(state));
    return {
      status: 'success',
      data: stateName ? places.cities.get(stateName) : [],
    };
  }

  /**
   * Schools of a city, A to Z. `search` may be several words; each word
   * must appear in the school name, village or block, or start the UDISE
   * code or pincode ("govt rampur", "50008").
   */
  async listSchools(query: {
    state: string;
    city: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const places = await this.placeIndex();
    const stateName = places.stateNames.get(placeKey(query.state));
    const cityName = places.cityNames.get(
      `${placeKey(query.state)}|${placeKey(query.city)}`,
    );
    if (!stateName || !cityName) {
      return { status: 'success', data: [], total: 0, limit, offset };
    }

    const where = and(
      eq(zuvySchools.state, stateName),
      eq(zuvySchools.district, cityName),
      eq(zuvySchools.isActive, true),
      ...this.searchConditions(query.search),
    );

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          udiseCode: zuvySchools.udiseCode,
          schoolName: zuvySchools.schoolName,
          village: zuvySchools.village,
          block: zuvySchools.block,
          pincode: zuvySchools.pincode,
          management: zuvySchools.management,
          classFrom: zuvySchools.classFrom,
          classTo: zuvySchools.classTo,
        })
        .from(zuvySchools)
        .where(where)
        .orderBy(asc(zuvySchools.schoolName), asc(zuvySchools.udiseCode))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(zuvySchools).where(where),
    ]);

    return {
      status: 'success',
      data: rows,
      total: Number(total),
      limit,
      offset,
    };
  }

  /**
   * The list's spelling of a state and city (any letter case), or null when
   * that state has no such city. Used when a student types in a school
   * that is not listed: the state and city must still come from the list.
   */
  async findPlace(state: string, city: string) {
    const places = await this.placeIndex();
    const stateName = places.stateNames.get(placeKey(state));
    const cityName = places.cityNames.get(
      `${placeKey(state)}|${placeKey(city)}`,
    );
    return stateName && cityName ? { state: stateName, city: cityName } : null;
  }

  /** The active school with this UDISE code, or null. */
  async findActiveByUdise(udiseCode: string) {
    const [school] = await db
      .select()
      .from(zuvySchools)
      .where(
        and(
          eq(zuvySchools.udiseCode, udiseCode),
          eq(zuvySchools.isActive, true),
        ),
      )
      .limit(1);
    return school ?? null;
  }

  /**
   * Super admin: add or correct a few schools with a CSV. New UDISE codes
   * are added; existing ones are updated and made active. Bad rows are
   * skipped and reported. (The full UDISE list is loaded once with
   * scripts/import-schools.ts instead.)
   */
  async importCsv(actorUserId: number, csvText: string) {
    const roles = await this.authService.getUserRoles(
      Number(actorUserId),
      null,
    );
    if (!roles.includes('super_admin')) {
      throw new ForbiddenException(
        'Only super admins can upload the school list',
      );
    }

    let parsed: ReturnType<typeof parseSchoolCsv>;
    try {
      parsed = parseSchoolCsv(csvText);
    } catch (error) {
      if (error instanceof SchoolCsvError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Reuse the list's spelling of each state and city.
    const placeNames = await loadPlaceNames(db);
    const rows = parsed.rows.map((row) => placeNames.apply(row));

    let inserted = 0;
    let updated = 0;
    for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
      const saved = await upsertSchools(
        db,
        rows.slice(i, i + UPSERT_BATCH_SIZE),
      );
      inserted += saved.inserted;
      updated += saved.updated;
    }
    this.places = null; // show new states and cities straight away

    this.logger.log(
      `School list upload by user ${actorUserId}: ${inserted} added, ${updated} updated, ${parsed.errors.length} skipped`,
    );

    const errors: RowError[] = parsed.errors.slice(0, MAX_ERRORS_RETURNED);
    return {
      status: 'success',
      message: `${inserted} schools added, ${updated} updated, ${parsed.errors.length} rows skipped`,
      data: {
        totalRows: parsed.totalRows,
        inserted,
        updated,
        skipped: parsed.errors.length,
        errors,
        moreErrors: Math.max(0, parsed.errors.length - errors.length),
      },
    };
  }

  private searchConditions(search?: string): SQL[] {
    const words = (search ?? '')
      // % and _ are LIKE wildcards and the backslash its escape character;
      // none of them appear in school names.
      .replace(/[%_\\]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, MAX_SEARCH_WORDS);
    return words.map((word) =>
      or(
        ilike(zuvySchools.schoolName, `%${word}%`),
        ilike(zuvySchools.village, `%${word}%`),
        ilike(zuvySchools.block, `%${word}%`),
        like(zuvySchools.udiseCode, `${word.toUpperCase()}%`),
        like(zuvySchools.pincode, `${word}%`),
      ),
    );
  }

  /**
   * All states and cities with an active school. Built from one query and
   * kept for 10 minutes; requests that arrive while it loads share it.
   */
  private async placeIndex(): Promise<PlaceIndex> {
    if (this.places && Date.now() - this.places.loadedAt < PLACES_CACHE_MS) {
      return this.places;
    }
    if (!this.placesLoading) {
      this.placesLoading = this.loadPlaceIndex()
        .then((index) => (this.places = index))
        .finally(() => (this.placesLoading = null));
    }
    return this.placesLoading;
  }

  private async loadPlaceIndex(): Promise<PlaceIndex> {
    const pairs = await db
      .selectDistinct({
        state: zuvySchools.state,
        district: zuvySchools.district,
      })
      .from(zuvySchools)
      .where(eq(zuvySchools.isActive, true))
      .orderBy(asc(zuvySchools.state), asc(zuvySchools.district));

    const index: PlaceIndex = {
      states: [],
      stateNames: new Map(),
      cities: new Map(),
      cityNames: new Map(),
      loadedAt: Date.now(),
    };
    for (const { state, district } of pairs) {
      if (!index.cities.has(state)) {
        index.states.push(state);
        index.stateNames.set(placeKey(state), state);
        index.cities.set(state, []);
      }
      index.cities.get(state).push(district);
      index.cityNames.set(`${placeKey(state)}|${placeKey(district)}`, district);
    }
    return index;
  }
}
