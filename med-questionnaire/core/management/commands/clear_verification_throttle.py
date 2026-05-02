"""
Clear OTP send history for an email (dev / recovery).

Usage:
  python manage.py clear_verification_throttle user@example.com
  python manage.py clear_verification_throttle user@example.com --purpose patient_login
"""

from django.core.management.base import BaseCommand

from core.models import EmailVerificationCode


class Command(BaseCommand):
    help = "Delete EmailVerificationCode rows for an email (clears hourly throttle + cooldown context)."

    def add_arguments(self, parser):
        parser.add_argument("email", type=str, help="Email address (normalized to lowercase)")
        parser.add_argument(
            "--purpose",
            type=str,
            choices=[c[0] for c in EmailVerificationCode.PURPOSE_CHOICES],
            help="Limit deletion to one purpose (default: all purposes for this email)",
        )

    def handle(self, *args, **options):
        raw_email = (options["email"] or "").strip().lower()
        purpose = options.get("purpose")
        if not raw_email:
            self.stderr.write(self.style.ERROR("Email is required."))
            return

        qs = EmailVerificationCode.objects.filter(email__iexact=raw_email)
        if purpose:
            qs = qs.filter(purpose=purpose)
        n, _ = qs.delete()
        self.stdout.write(
            self.style.SUCCESS(f"Deleted {n} EmailVerificationCode row(s) for {raw_email}" + (f" ({purpose})" if purpose else ""))
        )
