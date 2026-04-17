from django.core.management.base import BaseCommand
from core.models import LabIndicator


INDICATORS = [
    # --- MINERALS ---
("Iron", "mineral", "µg/dL", 60, 170),
("Magnesium", "mineral", "mmol/L", 0.66, 1.07),
("Calcium", "mineral", "mmol/L", 2.1, 2.6),
("Ionized Calcium", "mineral", "mmol/L", 1.1, 1.3),
("Zinc", "mineral", "µg/dL", 70, 120),
("Copper", "mineral", "µg/dL", 70, 140),
("Sodium", "mineral", "mmol/L", 135, 145),
("Potassium", "mineral", "mmol/L", 3.5, 5.1),
("Chloride", "mineral", "mmol/L", 98, 107),
("Phosphorus", "mineral", "mmol/L", 0.8, 1.5),
("Selenium", "mineral", "µg/L", 70, 150),
("Manganese", "mineral", "µg/L", 4, 15),

    # --- HORMONES ---
("TSH", "hormone", "mIU/L", 0.4, 4.0),
("Free T3", "hormone", "pmol/L", 3.1, 6.8),
("Free T4", "hormone", "pmol/L", 12, 22),
("Cortisol", "hormone", "nmol/L", 140, 690),
("Insulin", "hormone", "µIU/mL", 2, 25),
("Testosterone (male)", "hormone", "nmol/L", 8, 30),
("Testosterone (female)", "hormone", "nmol/L", 0.3, 2.4),
("Estradiol", "hormone", "pg/mL", 15, 350),
("Progesterone", "hormone", "ng/mL", 0.2, 25),
("Prolactin", "hormone", "ng/mL", 4, 23),
("LH", "hormone", "mIU/mL", 1.5, 9.3),
("FSH", "hormone", "mIU/mL", 1.4, 18.1),
("DHEA-S", "hormone", "µg/dL", 35, 430),
("Growth Hormone", "hormone", "ng/mL", 0, 10),
("ACTH", "hormone", "pg/mL", 7, 63),

    # --- VITAMINS ---
]

# Codes must match keys used in core/risk_engine.py (labs.get("glucose") etc.)
RISK_LAB_INDICATORS = [
    ("glucose", "Glucose (fasting)", "Glucose", "metabolic", "mmol/L", 3.9, 6.0),
    ("hba1c", "HbA1c", "HbA1c", "metabolic", "%", 4.0, 5.7),
    ("hemoglobin", "Hemoglobin", "Hemoglobin", "anemia", "g/L", 120.0, 160.0),
    ("ldl", "LDL cholesterol", "LDL", "cardiovascular", "mmol/L", None, 3.0),
    ("hdl", "HDL cholesterol", "HDL", "cardiovascular", "mmol/L", 1.0, None),
    ("triglycerides", "Triglycerides", "Triglycerides", "cardiovascular", "mmol/L", None, 1.7),
    ("creatinine", "Creatinine", "Creatinine", "renal", "µmol/L", 59.0, 104.0),
    ("alt", "ALT (alanine aminotransferase)", "ALT", "hepatic", "U/L", None, 40.0),
    ("tsh", "TSH", "TSH", "endocrine", "mIU/L", 0.4, 4.0),
    ("vitamin_d", "25-OH vitamin D", "Vitamin D", "vitamin", "ng/mL", 30.0, 100.0),
    ("ferritin", "Ferritin", "Ferritin", "iron", "ng/mL", 30.0, 400.0),
]


class Command(BaseCommand):
    help = "Seed lab indicators"

    def handle(self, *args, **kwargs):
        created_count = 0
        updated_count = 0

        for name, category, unit, min_n, max_n in INDICATORS:
            obj, created = LabIndicator.objects.get_or_create(
                name=name,
                defaults={
                    "category": category,
                    "unit": unit,
                    "min_norm": min_n,
                    "max_norm": max_n,
                },
            )

            if created:
                created_count += 1
            else:
                changed = False
                if obj.category != category:
                    obj.category = category
                    changed = True
                if obj.unit != unit:
                    obj.unit = unit
                    changed = True
                if obj.min_norm != min_n:
                    obj.min_norm = min_n
                    changed = True
                if obj.max_norm != max_n:
                    obj.max_norm = max_n
                    changed = True
                if changed:
                    obj.save(update_fields=["category", "unit", "min_norm", "max_norm"])
                    updated_count += 1

        risk_created = 0
        risk_updated = 0
        for code, standard_name, name, category, unit, min_n, max_n in RISK_LAB_INDICATORS:
            obj = LabIndicator.objects.filter(code=code).first()
            if obj:
                obj.standard_name = standard_name
                obj.name = name
                obj.category = category
                obj.unit = unit
                obj.min_norm = min_n
                obj.max_norm = max_n
                obj.save(
                    update_fields=["standard_name", "name", "category", "unit", "min_norm", "max_norm"]
                )
                risk_updated += 1
            else:
                LabIndicator.objects.create(
                    code=code,
                    standard_name=standard_name,
                    name=name,
                    category=category,
                    unit=unit,
                    min_norm=min_n,
                    max_norm=max_n,
                )
                risk_created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully created {created_count} indicators and updated {updated_count} indicators; "
                f"risk engine labs: created {risk_created}, updated {risk_updated}"
            )
        )