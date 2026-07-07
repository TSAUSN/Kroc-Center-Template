const ALERT_ITEMS = [
  {{each global_site_alert_banner as alert}}
  {{alert.toJson()}}
  {{alert._arraycomma}}
  {{end-each}}
];

const ALERT_STYLES = {
  warning: {
    bar: "bg-[rgba(242,171,83,0.28)] text-[#5a4119] border-[rgba(242,171,83,0.5)]",
    icon: "#i-warn",
    iconColor: "text-[#a86b0e]"
  },
  info: {
    bar: "bg-[rgba(0,32,86,0.08)] text-secondary border-[rgba(0,32,86,0.15)]",
    icon: "#i-info",
    iconColor: ""
  },
  danger: {
    bar: "bg-[rgba(239,62,66,0.12)] text-[#9e121c] border-[rgba(239,62,66,0.3)]",
    icon: "#i-emerg",
    iconColor: ""
  },
  navy: {
    bar: "bg-[rgba(0,32,86,0.12)] text-secondary border-[rgba(0,32,86,0.2)]",
    icon: "#i-info",
    iconColor: ""
  },
  dark: { bar: "bg-[#1c1b1f] text-white border-black", icon: "#i-info", iconColor: "" }
};

const parseAlertDate = (s) => {
  if (!s) {
    return null;
  }
  const d = new Date(String(s).replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
};

const isAlertActive = (a) => {
  if (!a || !a.alert_message) {
    return false;
  }
  const now = new Date();
  const start = parseAlertDate(a.start_date);
  const end = parseAlertDate(a.end_date);
  if (start && now < start) {
    return false;
  }
  if (end && now > end) {
    return false;
  }
  return true;
};

const isTruthyFlag = (v) => v === true || v === 1 || v === "1" || v === "true" || v === "yes";

function AlertBar(props) {
  const a = props.alert;
  const dismissKey = "kroc-alert-dismissed:" + (a.zuid || a.banner_name || "default");

  const [dismissed, setDismissed] = React.useState(() => {
    try {
      return !!sessionStorage.getItem(dismissKey);
    } catch (err) {
      return false;
    }
  });

  if (dismissed) {
    return null;
  }

  const variant = String(a.alert_variant || "").toLowerCase();
  const style = ALERT_STYLES[variant] || ALERT_STYLES.warning;
  const dismissable = isTruthyFlag(a.dismissable);
  const messageHtml = { __html: a.alert_message };

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch (err) {
      /* private mode — dismiss just won't persist */
    }
    setDismissed(true);
  };

  return (
    <div
      className={cx(
        "relative z-50 flex w-full items-center gap-3 border-b px-4 py-2.5 text-[13.5px] lg:px-8",
        style.bar
      )}
      role="status"
    >
      <span
        className={cx(
          "inline-flex h-[18px] w-[18px] flex-none items-center justify-center",
          style.iconColor
        )}
      >
        <Icon className="h-[18px] w-[18px]" id={style.icon} />
      </span>
      <span className="min-w-0 [&_p]:m-0 [&_p]:inline" dangerouslySetInnerHTML={messageHtml}></span>
      {a.button_text && (
        <a
          href={a.button_link || "#"}
          className="ml-auto flex-none whitespace-nowrap rounded-lg bg-white px-3.5 py-1.5 text-[12.5px] text-content"
        >
          {a.button_text}
        </a>
      )}
      {dismissable && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className={cx("flex-none cursor-pointer", a.button_text ? "ml-2" : "ml-auto")}
        >
          <Icon className="h-4 w-4" id="#i-close" />
        </button>
      )}
    </div>
  );
}

function SiteAlert() {
  const active = ALERT_ITEMS.filter(isAlertActive);
  if (!active.length) {
    return null;
  }
  return (
    <React.Fragment>
      {active.map((a) => (
        <AlertBar key={a.zuid || a.banner_name} alert={a} />
      ))}
    </React.Fragment>
  );
}
