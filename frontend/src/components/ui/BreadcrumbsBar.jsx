import { Breadcrumbs, Typography } from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import { Link as RouterLink, useLocation, matchPath } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * Each entry maps a route pattern (react-router style) to a function that returns
 * an array of crumbs ({ to?: string, labelKey: string, label?: string }).
 *
 * Matched patterns are evaluated in declaration order; the first match wins.
 * Crumbs without a `to` are rendered as plain text (current page).
 *
 * Keep this dictionary small and predictable — exotic / dynamic-only routes can fall
 * back to a single derived crumb via the default branch below.
 */
const ROUTE_DEFS = [
  // Doctor / chief
  { pattern: "/", crumbs: () => [{ labelKey: "navbar.dashboard" }] },
  {
    pattern: "/patients",
    crumbs: () => [{ labelKey: "navbar.patients" }],
  },
  {
    pattern: "/patients/:id/questionnaires/:questionnaireId",
    crumbs: ({ params }) => [
      { labelKey: "navbar.patients", to: "/patients" },
      { labelKey: "navbar.patients", to: `/patients/${params.id}`, label: `#${params.id}` },
      { labelKey: "navbar.questionnaires" },
    ],
  },
  {
    pattern: "/patients/:id/questionnaires",
    crumbs: ({ params }) => [
      { labelKey: "navbar.patients", to: "/patients" },
      { labelKey: "navbar.patients", to: `/patients/${params.id}`, label: `#${params.id}` },
      { labelKey: "navbar.questionnaires" },
    ],
  },
  {
    pattern: "/patients/:id/assessments/:assessmentId",
    crumbs: ({ params }) => [
      { labelKey: "navbar.patients", to: "/patients" },
      { labelKey: "navbar.patients", to: `/patients/${params.id}`, label: `#${params.id}` },
      { labelKey: "navbar.assessments" },
    ],
  },
  {
    pattern: "/patients/:id",
    crumbs: ({ params }) => [
      { labelKey: "navbar.patients", to: "/patients" },
      { labelKey: "navbar.patients", label: `#${params.id}` },
    ],
  },
  {
    pattern: "/profile",
    crumbs: () => [{ labelKey: "navbar.profile" }],
  },
  {
    pattern: "/questionnaires/create",
    crumbs: () => [
      { labelKey: "navbar.myQuestionnaires", to: "/questionnaires/my" },
      { labelKey: "navbar.questionnaires" },
    ],
  },
  {
    pattern: "/questionnaires/:id/edit",
    crumbs: ({ params }) => [
      { labelKey: "navbar.myQuestionnaires", to: "/questionnaires/my" },
      { labelKey: "navbar.questionnaires", label: `#${params.id}` },
    ],
  },
  {
    pattern: "/questionnaires/my",
    crumbs: () => [{ labelKey: "navbar.myQuestionnaires" }],
  },
  {
    pattern: "/questionnaires/pending",
    crumbs: () => [{ labelKey: "navbar.pendingQuestionnaires" }],
  },
  {
    pattern: "/questionnaires/archive",
    crumbs: () => [{ labelKey: "navbar.archive" }],
  },
  {
    pattern: "/questionnaires/review/:id",
    crumbs: ({ params }) => [
      { labelKey: "navbar.pendingQuestionnaires", to: "/questionnaires/pending" },
      { labelKey: "navbar.questionnaires", label: `#${params.id}` },
    ],
  },
  {
    pattern: "/questionnaires/:id",
    crumbs: ({ params }) => [
      { labelKey: "navbar.myQuestionnaires", to: "/questionnaires/my" },
      { labelKey: "navbar.questionnaires", label: `#${params.id}` },
    ],
  },
  {
    pattern: "/users/roles",
    crumbs: () => [{ labelKey: "navbar.userRoles" }],
  },
  {
    pattern: "/audit-log",
    crumbs: () => [{ labelKey: "navbar.auditLog" }],
  },
  {
    pattern: "/awaiting-approval",
    crumbs: () => [{ labelKey: "navbar.awaitingApproval" }],
  },

  // Patient
  {
    pattern: "/patient/questionnaires/:id/:questionnaireId",
    crumbs: () => [
      { labelKey: "patientPortal.menu.questionnaires", to: "/patient/questionnaires" },
      { labelKey: "patientPortal.menu.questionnaires" },
    ],
  },
  {
    pattern: "/patient/assessments/:id/:assessmentId",
    crumbs: () => [
      { labelKey: "patientPortal.menu.home", to: "/patient" },
      { labelKey: "navbar.assessments" },
    ],
  },
  { pattern: "/patient/labs", crumbs: () => [{ labelKey: "patientPortal.menu.labs" }] },
  {
    pattern: "/patient/questionnaires",
    crumbs: () => [{ labelKey: "patientPortal.menu.questionnaires" }],
  },
  {
    pattern: "/patient/recommendations",
    crumbs: () => [{ labelKey: "patientPortal.menu.recommendations" }],
  },
  {
    pattern: "/patient/notifications",
    crumbs: () => [{ labelKey: "patientPortal.menu.notifications" }],
  },
  { pattern: "/patient", crumbs: () => [{ labelKey: "patientPortal.menu.home" }] },
];

function resolveCrumbs(pathname) {
  for (const def of ROUTE_DEFS) {
    const m = matchPath({ path: def.pattern, end: true }, pathname);
    if (m) return def.crumbs({ params: m.params || {} });
  }
  return [];
}

/**
 * Renders breadcrumbs based on the current pathname. Home crumb is always prepended.
 * If only the home crumb is resolvable, returns null so it doesn't clutter the topbar.
 */
export default function BreadcrumbsBar({ homeTo = "/" }) {
  const { t } = useTranslation();
  const location = useLocation();
  const crumbs = resolveCrumbs(location.pathname);

  if (!crumbs.length) return null;

  const items = [
    { to: homeTo, labelKey: "topbar.breadcrumbHome", isHome: true },
    ...crumbs,
  ];

  return (
    <Breadcrumbs
      separator={<NavigateNextRoundedIcon fontSize="small" />}
      aria-label="breadcrumb"
      sx={{ minWidth: 0, "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" } }}
    >
      {items.map((c, index) => {
        const isLast = index === items.length - 1;
        const label = c.label || t(c.labelKey);
        if (isLast || !c.to) {
          return (
            <Typography
              key={`${c.labelKey}-${index}`}
              variant="body2"
              color={isLast ? "text.primary" : "text.secondary"}
              sx={{
                fontWeight: isLast ? 700 : 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 220,
                display: "flex",
                alignItems: "center",
                gap: 0.5,
              }}
            >
              {c.isHome ? <HomeRoundedIcon sx={{ fontSize: 16 }} /> : null}
              {c.isHome ? null : label}
            </Typography>
          );
        }
        return (
          <Typography
            key={`${c.labelKey}-${index}`}
            component={RouterLink}
            to={c.to}
            variant="body2"
            sx={{
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 220,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            {c.isHome ? <HomeRoundedIcon sx={{ fontSize: 16 }} /> : label}
          </Typography>
        );
      })}
    </Breadcrumbs>
  );
}
