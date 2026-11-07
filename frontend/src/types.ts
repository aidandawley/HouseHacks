// Mirrors backend/models.py (plan section 7). Keep in sync.

export type FundingStatus = "committed" | "conditional" | "potential";
export type FundingInstrument = "development_grant" | "donation" | "repayable_loan" | "buyer_assistance";
export type FundingBasis = "illustrative_assumption" | "user_entered" | "reference_only" | "verified_public_source";

export interface SourceMetadata {
  title: string;
  publisher: string;
  url: string;
  publication_date?: string | null;
  page_or_section?: string | null;
  fact_supported: string;
}

export interface HouseholdInputs {
  annual_income: number;
  household_size: number;
  housing_cost_ratio: number;
  annual_mortgage_rate: number;
  mortgage_term_years: number;
  other_housing_costs_monthly: number;
  buyer_cash_down_payment: number;
}

export interface DevelopmentInputs {
  land_cost: number;
  site_work_cost: number;
  gross_sqft_per_home: number;
  hard_cost_per_sqft: number;
  soft_cost_rate: number;
  contingency_rate: number;
  financing_rate: number;
  illustrative_site_capacity: number;
  additional_subsidy_budget: number;
}

export interface FundingSource {
  id: string;
  name: string;
  amount: number | null;
  /** Documented ceiling of a conditional award; never cash received. */
  documented_max?: number | null;
  status: FundingStatus;
  instrument: FundingInstrument;
  basis: FundingBasis;
  source: SourceMetadata | null;
}

export interface ReferenceLink {
  title: string;
  url: string;
  usage: "reference_only";
  reference_source_id?: string;
}

export interface ReferenceSource {
  id: string;
  name: string;
  source_url: string;
  landing_url?: string;
  checked_at: string;
  effective_date?: string;
  source_kind: "published_rate" | "published_income_limit" | "statute" | "cost_study" | "candidate_program";
  verification_status: "team_verified" | "organizer_verified_page" | "unverified";
  limitations: string;
  value?: number;
  unit?: string;
  page?: number;
  table?: string;
  household_sizes?: number[];
  limits?: Record<string, number[]>;
  area_median_income_4_person?: number;
}

export type FactStatus = "DOCUMENTED" | "DERIVED" | "ASSUMPTION" | "UNKNOWN";

export interface SiteFact {
  key: string;
  label: string;
  value: string | number | null;
  unit?: string | null;
  status: FactStatus;
  source_id?: string | null;
  page?: number | null;
  note?: string | null;
}

export interface Site {
  address?: string | null;
  apn?: string | null;
  buildings?: number | null;
  units_per_building?: number | null;
  visualization_status: string;
  facts: SiteFact[];
}

export interface ProjectSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  published?: string | null;
  checked_at: string;
  verification_status: string;
  note?: string | null;
}

export interface InputProvenance {
  kind: Provenance | string;
  source_id?: string | null;
  note?: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  kind: "seed" | "user";
  is_default: boolean;
  case_type: string;
  location: string | null;
  summary: string | null;
  candidate_home_counts: number[];
  updated_at: string | null;
}

/** Full project as returned by GET /api/projects/{id} (and /api/case-study for the default). */
export interface Project {
  id: string;
  name: string;
  kind: "seed" | "user";
  is_default: boolean;
  case_type: "documented_site" | "illustrative" | "user" | string;
  location: string | null;
  summary: string | null;
  site: Site | null;
  sources: ProjectSource[];
  reference_links: ReferenceLink[];
  candidate_home_counts: number[];
  default_home_count?: number | null;
  scenario_labels: Record<string, string>;
  household: HouseholdInputs;
  development: DevelopmentInputs;
  funding_sources: FundingSource[];
  input_provenance: Record<string, InputProvenance>;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  reference_sources: { about: string; records: ReferenceSource[] };
}

export interface CompareRequest {
  candidate_home_counts: number[];
  household: HouseholdInputs;
  development: DevelopmentInputs;
  funding_sources: FundingSource[];
}

export interface AffordabilityResult {
  monthly_housing_budget: number;
  monthly_principal_interest_available: number;
  mortgage_principal: number;
  affordable_sale_price_per_home: number;
  affordability_valid: boolean;
}

export interface FundingRowResult {
  id: string;
  name: string;
  amount: number | null;
  counted_amount: number;
  counted: boolean;
  reason: string;
}

export interface FundingSummary {
  counted_project_support: number;
  committed_assumed_amount: number;
  conditional_modeled_amount: number;
  potential_uncommitted_amount: number;
  excluded_amount: number;
  excluded_instruments: string[];
  has_illustrative_commitments: boolean;
  rows: FundingRowResult[];
}

export interface ScenarioResult {
  homes: number;
  land_cost: number;
  site_work_cost: number;
  hard_cost: number;
  soft_cost: number;
  contingency: number;
  financing_cost: number;
  total_development_cost: number;
  sale_price_per_home: number;
  sale_proceeds: number;
  counted_project_support: number;
  raw_gap: number;
  remaining_gap: number;
  modeled_surplus: number;
  gap_per_home: number;
  additional_budget_headroom: number;
  within_subsidy_cap: boolean;
  within_capacity: boolean;
  eligible: boolean;
}

export interface CompareResponse {
  affordability: AffordabilityResult;
  funding: FundingSummary;
  scenarios: ScenarioResult[];
  recommended_home_count: number | null;
  recommendation_reason: string;
  minimum_needed_if_none_fit: number | null;
  candidate_home_counts: number[];
  warnings: string[];
}

/** Provenance label shown next to every figure. */
export type Provenance =
  | "assumption"
  | "user"
  | "documented"
  | "derived"
  | "published_rate"
  | "published_income_limit"
  | "candidate"
  | "computed";
