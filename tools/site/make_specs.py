"""Write site/src/charts.json from the research files in site/data/.

Every number on the page's figures comes from those files, which record the source URL and the
retrieval date for each series. Rerun after refreshing the research:
    python3 tools/site/make_specs.py && python3 tools/site/build.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "site" / "data"


def load(name):
    return {s["id"]: s for s in json.loads((DATA / f"{name}.json").read_text())["series"]}


P, D, O, A = load("prices"), load("debt"), load("outcomes"), load("alternatives")


def pts(series, start=None):
    return [[int(x), y] for x, y in series["points"] if start is None or int(x) >= start]


def q4(series, scale=1.0):
    """Fourth quarter of each year, plus the latest quarter labelled as its own year."""
    out = [[int(p[:4]), round(v * scale)] for p, v in series["points"] if p.endswith("Q4")]
    last = series["points"][-1]
    if not last[0].endswith("Q4"):
        out.append([int(last[0][:4]), round(last[1] * scale)])
    return out


CB_PRICING = ["College Board, Trends in College Pricing 2026", "https://research.collegeboard.org/media/xlsx/trends-in-college-pricing-2026-excel-data.xlsx"]
NYFED = ["Federal Reserve Bank of New York, Household Debt and Credit, 2026 Q3", "https://www.newyorkfed.org/medialibrary/interactives/householdcredit/data/xls/HHD_C_Report_2026Q3.xlsx"]

charts = []

charts.append({
    "id": "index", "kind": "line", "num": "Figure 1",
    "title": "College prices rose more than three times as fast as prices overall",
    "subtitle": "Each line set to 100 in 1980. Not adjusted for inflation, so the lines can be compared directly.",
    "alt": "Line chart, 1980 to 2025, indexed to 100 in 1980. The college tuition price index reaches about 1,349; median household income about 494; average hourly earnings about 458; all consumer prices about 391.",
    "unit": "", "baseline": 100,
    "series": [
        {"name": "College tuition and fees (CPI)", "short": "Tuition", "role": "cost", "points": pts(P["index_cpi_college_tuition_1980eq100"])},
        {"name": "Median household income", "short": "Income", "role": "compare", "points": pts(P["index_median_household_income_1980eq100"])},
        {"name": "Average hourly earnings", "short": "Hourly pay", "role": "third", "points": pts(P["index_avg_hourly_earnings_1980eq100"])},
        {"name": "All consumer prices (CPI)", "short": "All prices", "role": "context", "points": pts(P["index_cpi_all_items_1980eq100"])},
    ],
    "sources": [["BLS CPI-U series CUUR0000SEEB01 and CUUR0000SA0", "https://data.bls.gov/timeseries/CUUR0000SEEB01"],
                ["Census CPS Table H-5", "https://www2.census.gov/programs-surveys/cps/tables/time-series/historical-income-households/h05.xlsx"],
                ["FRED AHETPI", "https://fred.stlouisfed.org/series/AHETPI"]],
    "note": "Annual averages. The tuition index tracks published prices, before grant aid.",
})

charts.append({
    "id": "sticker", "kind": "line", "num": "Figure 2",
    "title": "A year of tuition costs about three to four times what it did in 1980, after inflation",
    "subtitle": "Average published tuition and fees per year, in 2026 dollars, 1980-81 to 2026-27.",
    "alt": "Line chart of published tuition in 2026 dollars. Private nonprofit four-year rises from $14,610 to $46,350; public four-year from $3,230 to $12,290; public two-year from $1,570 to $4,210.",
    "unit": "$",
    "series": [
        {"name": "Private nonprofit four-year", "short": "Private", "role": "compare", "points": pts(P["cb_tuition_fees_pnp4_2026usd"], 1980)},
        {"name": "Public four-year, in state", "short": "Public 4-yr", "role": "cost", "points": pts(P["cb_tuition_fees_pub4_2026usd"], 1980)},
        {"name": "Public two-year", "short": "Public 2-yr", "role": "third", "points": pts(P["cb_tuition_fees_pub2_2026usd"], 1980)},
    ],
    "sources": [CB_PRICING],
    "note": "Year shown is the fall of the academic year. Prices since 2019-20 have eased in real terms.",
})

charts.append({
    "id": "net", "kind": "line", "num": "Figure 3",
    "title": "Grants cut tuition, but not the cost of being a student",
    "subtitle": "Public four-year, in state, first-time full-time students, 2026 dollars. Net means after grant aid.",
    "alt": "Line chart, 2006-07 to 2026-27. Net cost of attendance stays near $21,000 to $25,000; published tuition rises to about $12,300; net tuition after grants falls to about $1,900.",
    "unit": "$",
    "series": [
        {"name": "Net cost of attendance (with housing, food, books)", "short": "Net cost", "role": "cost", "points": pts(P["cb_net_coa_pub4_2026usd"])},
        {"name": "Published tuition and fees", "short": "Sticker", "role": "compare", "points": pts(P["cb_tuition_fees_pub4_2026usd"], 2006)},
        {"name": "Net tuition and fees", "short": "Net tuition", "role": "third", "points": pts(P["cb_net_tf_pub4_2026usd"])},
    ],
    "sources": [CB_PRICING],
    "note": "Values from 2024-25 on are College Board projections.",
})

charts.append({
    "id": "debt", "kind": "line", "num": "Figure 4",
    "title": "Student debt became one of the largest debts American households carry",
    "subtitle": "Balances on consumer credit reports, end of each year, not adjusted for inflation.",
    "alt": "Line chart, 2006 to 2026. Student loans rise from about $0.48 trillion to $1.66 trillion; auto loans reach $1.73 trillion; credit cards $1.29 trillion.",
    "unit": "$",
    "series": [
        {"name": "Student loans", "short": "Student", "role": "cost", "points": q4(D["nyfed_student_loan_balance"], 1e12)},
        {"name": "Auto loans", "short": "Auto", "role": "compare", "points": q4(D["nyfed_auto_loan_balance"], 1e12)},
        {"name": "Credit cards", "short": "Cards", "role": "third", "points": q4(D["nyfed_credit_card_balance"], 1e12)},
    ],
    "sources": [NYFED],
    "note": "2026 is the third quarter. The Federal Reserve's G.19 count, which includes all lenders, is higher: $1.88 trillion.",
})

nb = {c["label"]: c for c in O["six_year_completion_nsc_overall"]["categories"]} if "categories" in O["six_year_completion_nsc_overall"] else {c["label"]: c for c in O["six_year_completion_nsc_overall"]["points"]}
inc = {c["label"]: c["value"] for c in (O["six_year_completion_by_neighborhood_income"].get("categories") or O["six_year_completion_by_neighborhood_income"]["points"])}
charts.append({
    "id": "finish", "kind": "bars", "num": "Figure 5",
    "title": "Who finishes depends on who you are when you start",
    "subtitle": "Share of students who started in fall 2019 and earned any credential within six years.",
    "alt": "Bar chart of six-year completion: highest-income neighborhoods 75.9 percent, full-time starters 67.1, all starters 61.1, lowest-income neighborhoods 50.1, part-time starters 34.1.",
    "unit": "%", "value_label": "Completed within six years", "label_width": 300,
    "bars": [
        {"label": "Highest-income neighborhoods", "value": inc["Highest-income 20% of neighborhoods"], "role": "context", "text": "75.9%"},
        {"label": "Full-time starters", "value": nb["Full-time starters"]["completed"], "role": "context", "text": "67.1%"},
        {"label": "All starters", "value": nb["All starters"]["completed"], "role": "context", "text": "61.1%"},
        {"label": "Lowest-income neighborhoods", "value": inc["Lowest-income 20% of neighborhoods"], "role": "cost", "text": "50.1%"},
        {"label": "Part-time starters", "value": nb["Part-time starters"]["completed"], "role": "cost", "text": "34.1%"},
    ],
    "sources": [["National Student Clearinghouse Research Center", "https://nscresearchcenter.org/yearly-progress-and-completion/"]],
    "note": "Income is measured by the student's home neighborhood.",
})

bls = {c["label"]: c for c in O["bls_education_pays"]["categories"]}
order = ["Bachelor's degree", "Associate's degree", "Some college, no degree", "High school diploma", "Less than a high school diploma"]
labels = {"Bachelor's degree": "Bachelor's degree", "Associate's degree": "Associate's degree", "Some college, no degree": "Some college, no degree",
          "High school diploma": "High school diploma", "Less than a high school diploma": "Less than high school"}
charts.append({
    "id": "pays", "kind": "bars", "num": "Figure 6",
    "title": "The degree still pays. Starting and stopping barely does",
    "subtitle": "Median weekly earnings, workers 25 and older, 2025.",
    "alt": "Bar chart of median weekly earnings in 2025: bachelor's $1,578, associate's $1,135, some college no degree $1,062, high school $966, less than high school (see table).",
    "unit": "$", "value_label": "Median weekly earnings", "label_width": 260,
    "bars": [{"label": labels[k], "value": bls[k]["weekly_earnings"], "role": "cost" if k == "Some college, no degree" else ("compare" if k == "Bachelor's degree" else "context")} for k in order if k in bls],
    "sources": [["BLS, Education pays", "https://www.bls.gov/emp/tables/unemployment-earnings-education.htm"]],
    "note": "Some college, no degree is the group that pays the costs and gets the smallest premium.",
})

mooc = A["mooc_completion_by_year"]["points"][-1]
charts.append({
    "id": "mooc", "kind": "bars", "num": "Figure 7",
    "title": "Free courses alone did not get people to the finish",
    "subtitle": "Completion in HarvardX and MITx courses on edX, 2017-18 cohort.",
    "alt": "Bar chart: 3.1 percent of all participants completed, 15.4 percent of those who said they intended to, and 46 percent of those who paid for a verified certificate.",
    "unit": "%", "value_label": "Completed", "label_width": 280,
    "bars": [
        {"label": "Everyone who opened a course", "value": mooc["participants"], "role": "cost", "text": f'{mooc["participants"]}%'},
        {"label": "Said they intended to finish", "value": mooc["intended_to_complete"], "role": "context", "text": f'{mooc["intended_to_complete"]}%'},
        {"label": "Paid for a verified certificate", "value": mooc["verified_paid"], "role": "compare", "text": f'{mooc["verified_paid"]}%'},
    ],
    "sources": [["Reich and Ruiperez-Valiente, The MOOC Pivot, Science (2019)", "https://webs.um.es/jruiperez/papers/journals/2019_Science_MOOCPivot_postprint.pdf"]],
    "note": "Covers HarvardX and MITx only. Completion did not improve over six years.",
})

charts.append({
    "id": "tutor", "kind": "bars", "num": "Figure 8",
    "title": "Tutoring helps a lot, but not as much as legend says",
    "subtitle": "Measured effect on learning, in standard deviations. Studies differ in length and test breadth, so read these as ranges, not a league table.",
    "alt": "Bar chart of tutoring effect sizes: Bloom's 1984 claim 2.0; human tutoring 0.79; intelligent tutoring systems 0.76; a 2025 AI tutor trial 0.63; a PreK-12 tutoring meta-analysis 0.37; a 1982 meta-analysis 0.33.",
    "unit": "", "value_label": "Effect size (SD)", "label_width": 330,
    "bars": [
        {"label": "Bloom's 1984 claim (3-week studies)", "value": 2.0, "role": "context", "text": "2.0"},
        {"label": "Human tutoring (VanLehn 2011)", "value": 0.79, "role": "compare", "text": "0.79"},
        {"label": "Step-based tutoring software (VanLehn 2011)", "value": 0.76, "role": "compare", "text": "0.76"},
        {"label": "Guarded AI tutor, Harvard physics (2025)", "value": 0.63, "role": "third", "text": "0.63"},
        {"label": "PreK-12 tutoring meta-analysis (2020)", "value": 0.37, "role": "compare", "text": "0.37"},
        {"label": "Tutoring meta-analysis (1982)", "value": 0.33, "role": "compare", "text": "0.33"},
    ],
    "sources": [["von Hippel, Education Next (2024)", "https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/"],
                ["VanLehn (2011)", "https://eric.ed.gov/?id=EJ946764"], ["Kestin et al., Scientific Reports (2025)", "https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/"],
                ["Nickow, Oreopoulos and Quan, NBER (2020)", "https://www.nber.org/papers/w27476"]],
    "note": "The AI result is a two-week trial with an immediate, narrow test.",
})

inst = {p["sector"]: p for p in A["nces_instruction_per_fte"]["points"]}
charts.append({
    "id": "spend", "kind": "bars", "num": "Figure 9",
    "title": "What it costs to teach one student for a year, and what it costs to serve a page",
    "subtitle": "Instruction spending per full-time-equivalent student, 2020-21, against the per-learner cost of delivering static course files.",
    "alt": "Bar chart: private nonprofit four-year $20,060 per student on instruction; public four-year $13,540; public two-year $8,040; delivering Open Campus pages to one more learner, about $0.",
    "unit": "$", "value_label": "Per student per year", "label_width": 300,
    "bars": [
        {"label": "Private nonprofit four-year", "value": inst["Private nonprofit 4-year"]["instruction"], "role": "context", "text": f'${inst["Private nonprofit 4-year"]["instruction"]:,}'},
        {"label": "Public four-year", "value": inst["Public 4-year"]["instruction"], "role": "context", "text": f'${inst["Public 4-year"]["instruction"]:,}'},
        {"label": "Public two-year", "value": inst["Public 2-year"]["instruction"], "role": "context"},
        {"label": "Open Campus, delivery only", "value": 0, "role": "third", "text": "about $0"},
    ],
    "sources": [["NCES, Postsecondary Institution Expenses", "https://nces.ed.gov/programs/coe/indicator/cue/postsecondary-institution-expense"],
                ["Cloudflare static assets billing", "https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/"]],
    "note": "Delivery only. Writing and reviewing courses, exam fees and the learner's own AI are real costs and are not zero.",
})

(ROOT / "site" / "src" / "charts.json").write_text(json.dumps({"charts": charts}, indent=1) + "\n")
print(f"wrote {len(charts)} chart specs")
