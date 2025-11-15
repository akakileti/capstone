from flask import Flask, request, jsonify
from flask_cors import CORS

from .database import fetch_latest_projection, init_db, save_projection_run
from .model_trial import (
    BasicInfo,
    GrowthAssumptions,
    SavingsPlan,
    project_savings_with_retirement,
    rows_to_projection_cases,
)

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:4175",
            "http://127.0.0.1:4175"
        ]
    }
})
init_db()

@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"

@app.route("/api/calc/accumulation", methods=["POST"])
def calc_accumulation():
    data = request.get_json(force=True)

    basic = BasicInfo(**data["basicInfo"])
    assumptions = GrowthAssumptions(**data["growthAssumptions"])
    plan = SavingsPlan(**data["savingsPlan"])

    years_after_retirement = data.get("yearsAfterRetirement", 30)
    spending_change_yoy = data.get("spendingChangeYoY", 0.0)

    rows = project_savings_with_retirement(
        basic=basic,
        assumptions=assumptions,
        plan=plan,
        years_after_retirement=years_after_retirement,
        spending_change_yoy=spending_change_yoy,
    )
    cases = rows_to_projection_cases(rows)
    response_payload = [c.model_dump() for c in cases]
    save_projection_run(
        payload={
            "basicInfo": data["basicInfo"],
            "growthAssumptions": data["growthAssumptions"],
            "savingsPlan": data["savingsPlan"],
            "yearsAfterRetirement": years_after_retirement,
            "spendingChangeYoY": spending_change_yoy,
        },
        result=response_payload,
    )
    return jsonify(response_payload), 200

@app.route("/api/calc/latest", methods=["GET"])
def latest_projection():
    record = fetch_latest_projection()
    if record is None:
        return jsonify({"payload": None, "result": [], "createdAt": None}), 200
    return jsonify(record), 200

if __name__ == "__main__":
    app.run(debug=True, port=4050)
