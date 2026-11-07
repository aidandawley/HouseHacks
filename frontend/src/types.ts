// Mirrors backend/models.py (plan section 7). Keep in sync.

export type FundingStatus = "committed" | "potential";
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

export interface CaseStudy {
  id: string;
  name: string;
  location: string;
  case_type: "illustrative" | "verified";
  candidate_home_counts: number[];
  verified_facts: Record<string, unknown>;
  sources: SourceMetadata[];
  reference_links: ReferenceLink[];
  household: HouseholdInputs;
  development: DevelopmentInputs;
  funding_sources: FundingSource[];
  notes: string;
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

// Grows in milestone 3 (funding, scenarios, recommendation).
export interface CompareResponse {
  engine_status?: string;
  affordability: AffordabilityResult;
  candidate_home_counts: number[];
  case_type: string;
  warnings: string[];
}

/** Provenance label shown next to every figure. */
export type Provenance =
  | "assumption"
  | "user"
  | "published_rate"
  | "published_income_limit"
  | "candidate"
  | "computed";
