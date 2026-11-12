import React, { useEffect, useMemo, useRef, useState } from "react";

import {

  SafeAreaView,

  Animated,

  ScrollView,

  View,

  Text,

  TextInput,

  TouchableOpacity,

  StyleSheet,

  StatusBar,

  KeyboardAvoidingView,

  Platform,

  Alert,

} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

 

/* =========================================================

   EV ENERGY ADVISOR - UPDATED APP.JS

   Existing welcome, login, registration, profile, six

   scenarios, charts and BEP analysis are retained.

   ========================================================= */

 

const C = {

  bg: "#09030F",

  card: "#1B0B24",

  panel: "rgba(40,16,51,0.92)",

  border: "#713078",

  text: "#FFF7FF",

  muted: "#D0BBD8",

  teal: "#65F5FF",

  blue: "#8D8BFF",

  orange: "#FFB45E",

  red: "#FF527F",

  purple: "#C65CFF",

  green: "#8FFFE0",

  pink: "#FF3FA4",

  yellow: "#FFF18A",

  electric: "#F4C7FF",

};

 

/*

  DEMO CONTROL-OFFICER LOGIN

  Change these credentials before sharing the demo build.

  This is NOT secure production authentication. See the notes

  in the User Guide: real role security requires a backend.

*/

const CONTROL_OFFICER_EMAIL = "control@evenergyadvisor.lk";

const CONTROL_OFFICER_PASSWORD = "Control@2026";

 

const SCENARIOS = [

  {

    id: "S1", type: "V2G", route: "Home → Home",

    description: "Home charging followed by home V2G export.",

    chargingSource: "Home", ownerCapexKey: "v2gHomeCapex", ownerOMKey: "v2gHomeOM",

    serviceFee: 0, utilityClass: "V2G", ownerValueKey: "v2gOwnerValue",

  },

  {

    id: "S2", type: "V2G", route: "Home → Station",

    description: "Home charging followed by charging-station V2G export.",

    chargingSource: "Home", ownerCapexKey: null, ownerOMKey: null,

    serviceFee: 1, utilityClass: "V2G", ownerValueKey: "v2gOwnerValue",

  },

  {

    id: "S3", type: "V2G", route: "Station → Home",

    description: "Charging-station charging followed by home V2G export.",

    chargingSource: "Station", ownerCapexKey: "v2gHomeCapex", ownerOMKey: "v2gHomeOM",

    serviceFee: 1, utilityClass: "V2G", ownerValueKey: "v2gOwnerValue",

  },

  {

    id: "S4", type: "V2G", route: "Station → Station",

    description: "Charging-station charging and charging-station V2G export.",

    chargingSource: "Station", ownerCapexKey: null, ownerOMKey: null,

    serviceFee: 1, utilityClass: "V2G", ownerValueKey: "v2gOwnerValue",

  },

  {

    id: "S5", type: "V2H", route: "Station → Home",

    description: "Charging-station charging followed by household supply through a V2H unit.",

    chargingSource: "Station", ownerCapexKey: "v2hUnitCapex", ownerOMKey: "v2hAnnualOM",

    serviceFee: 1, utilityClass: "V2H", ownerValueKey: "v2hOwnerValue",

  },

  {

    id: "S6", type: "V2H", route: "Home → Home",

    description: "Home charging followed by household supply through a V2H unit.",

    chargingSource: "Home", ownerCapexKey: "v2hUnitCapex", ownerOMKey: "v2hAnnualOM",

    serviceFee: 0, utilityClass: "V2H", ownerValueKey: "v2hOwnerValue",

  },

];

 

const DEFAULTS = {

  // Common workbook assumptions

  battery: "50",

  dailyEnergy: "20",

  efficiency: "90",

  operatingDays: "365",

  lifetime: "5",

  discountRate: "10",

  escalation: "3",

 

  // Default daily charging-energy allocation (kWh/day).

  // Customers may edit their own Day and Off-peak kWh quantities.

  // The default is an equal split of 20 kWh/day discharged at 90% efficiency.

  dayKwh: "11.111111",

  offPeakKwh: "11.111111",

  homeDayTariff: "15",

  homeOffPeakTariff: "31",

  csRetailDayTariff: "87",

  csRetailOffPeakTariff: "53",

  csGridDayTariff: "15",

  csGridOffPeakTariff: "31",

  utilityChargingCostRate: "30.98",

 

  // Owner-value assumptions

  v2gOwnerValue: "45.80",

  v2hOwnerValue: "70",

  batteryDegradation: "10",

  stationServiceFee: "1",

 

  // Owner capital expenditure and annual O&M (Rs.)

  v2gHomeCapex: "3350000",

  v2gHomeOM: "99000",

  v2hUnitCapex: "131670",

  v2hAnnualOM: "3950.10",

 

  // Utility-side inputs (Rs.)

  baseAvoidedResourceValue: "115",

  utilityFactor: "1",

  v2gUtilityCapex: "100000",

  v2gUtilityOM: "5000",

  v2gAdminCost: "3",

  v2hUtilityCapex: "0",

  v2hUtilityOM: "0",

  v2hAdminCost: "0",

 

  // Additional peak tariff used only in the separate session calculator.

  // The weighted BEP tariff is calculated from Day and Off-peak kWh/day quantities.

  peakTariff: "106",

  sessionV2GExportValue: "45.80",

  sessionV2HValue: "70",

};

 

const DEFAULT_SESSION = {

  chargeSource: "Home",

  chargePeak: "0",

  chargeDay: "5",

  chargeOffPeak: "5",

  dischargeUnits: "8",

  dischargeMode: "V2G",

  chargeStart: "22:30",

  chargeEnd: "06:30",

  dischargeStart: "18:30",

  dischargeEnd: "20:30",

};

 

const num = (value) => {

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;

};

 

const fmt = (value) =>

  "Rs. " + (Number(value) || 0).toLocaleString("en-US", {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

  });

 

const fmt2 = (value) => (Number(value) || 0).toFixed(2);

const fmt9 = (value) => (Number(value) || 0).toFixed(9);

 

function escalatingPVFactor(discountRate, escalation, years) {

  const r = num(discountRate) / 100;

  const g = num(escalation) / 100;

  const n = Math.max(1, Math.floor(num(years)));

  let total = 0;

  for (let t = 1; t <= n; t += 1) {

    total += Math.pow(1 + g, t - 1) / Math.pow(1 + r, t);

  }

  return total;

}

 

function weightedTariff(dayRate, offPeakRate, dayKwh, offPeakKwh) {

  const totalKwh = num(dayKwh) + num(offPeakKwh);

  if (totalKwh <= 0) return 0;

  return (

    num(dayRate) * num(dayKwh) +

    num(offPeakRate) * num(offPeakKwh)

  ) / totalKwh;

}

 

function calculate(inputs, scenario) {

  const efficiency = num(inputs.efficiency) / 100;

  const dailyEnergy = num(inputs.dailyEnergy);

  const operatingDays = num(inputs.operatingDays);

  const annualEnergy = dailyEnergy * operatingDays;

  const annualCharge = efficiency > 0 ? annualEnergy / efficiency : 0;

  const annualEfficiencyLoss = annualCharge - annualEnergy;

 

  const homeWeightedTariff = weightedTariff(

    inputs.homeDayTariff, inputs.homeOffPeakTariff,

    inputs.dayKwh, inputs.offPeakKwh

  );

  const csRetailWeightedTariff = weightedTariff(

    inputs.csRetailDayTariff, inputs.csRetailOffPeakTariff,

    inputs.dayKwh, inputs.offPeakKwh

  );

  const csGridPurchaseWeightedTariff = weightedTariff(

    inputs.csGridDayTariff, inputs.csGridOffPeakTariff,

    inputs.dayKwh, inputs.offPeakKwh

  );

 

  const chargingTariff = scenario.chargingSource === "Home"

    ? homeWeightedTariff

    : csRetailWeightedTariff;

  const annualChargingCost = annualCharge * chargingTariff;

  const annualDegradationCost = annualEnergy * num(inputs.batteryDegradation);

  const serviceFeeRate = scenario.serviceFee === 0

    ? 0

    : num(inputs.stationServiceFee);

  const annualServiceFee = annualEnergy * serviceFeeRate;

 

  const pvFactor = escalatingPVFactor(

    inputs.discountRate, inputs.escalation, inputs.lifetime

  );

  const ownerCapital = scenario.ownerCapexKey

    ? num(inputs[scenario.ownerCapexKey]) : 0;

  const ownerAnnualOM = scenario.ownerOMKey

    ? num(inputs[scenario.ownerOMKey]) : 0;

  const ownerAnnualizedCapital = pvFactor > 0 ? ownerCapital / pvFactor : 0;

  const ownerAnnualFixedCost = ownerAnnualizedCapital + ownerAnnualOM;

  const ownerAnnualVariableCost =

    annualChargingCost + annualDegradationCost + annualServiceFee;

  const ownerTotal = ownerAnnualFixedCost + ownerAnnualVariableCost;

  const prosumerBEP = annualEnergy > 0 ? ownerTotal / annualEnergy : 0;

  const ownerValue = num(inputs[scenario.ownerValueKey]);

  const ownerValueMargin = ownerValue - prosumerBEP;

 

  const utilityCapex = scenario.utilityClass === "V2G"

    ? num(inputs.v2gUtilityCapex) : num(inputs.v2hUtilityCapex);

  const utilityOM = scenario.utilityClass === "V2G"

    ? num(inputs.v2gUtilityOM) : num(inputs.v2hUtilityOM);

  const adminRate = scenario.utilityClass === "V2G"

    ? num(inputs.v2gAdminCost) : num(inputs.v2hAdminCost);

  const utilityAnnualizedCapital = pvFactor > 0 ? utilityCapex / pvFactor : 0;

  const utilityAnnualFixedCost = utilityAnnualizedCapital + utilityOM;

  const utilityChargingMargin = annualCharge * (

    csGridPurchaseWeightedTariff - num(inputs.utilityChargingCostRate)

  );

  const annualChargingCostShortfall = -utilityChargingMargin;

  const utilityAdminCost = annualEnergy * adminRate;

  const utilityAnnualNetVariableCost = utilityAdminCost + annualChargingCostShortfall;

  const utilityAnnualCostForBEP = utilityAnnualFixedCost + utilityAnnualNetVariableCost;

  const utilityCostBEP = annualEnergy > 0

    ? utilityAnnualCostForBEP / annualEnergy : 0;

 

  const utilityFactor = num(inputs.utilityFactor);

  const baseAvoidedResourceValue = num(inputs.baseAvoidedResourceValue);

  const utilityBaseEconomicCeiling =

    (baseAvoidedResourceValue * utilityFactor) - utilityCostBEP;

  const economicGap = utilityBaseEconomicCeiling - prosumerBEP;

 

  const annualAvoidedResourceBenefit =

    annualEnergy * baseAvoidedResourceValue * utilityFactor;

  const grossUtilityValue =

    annualAvoidedResourceBenefit - utilityAnnualCostForBEP;

 

  const ownerValuePass = ownerValue >= prosumerBEP;

  const economicIntervalPass = utilityBaseEconomicCeiling > prosumerBEP;

  const viable = ownerValuePass && economicIntervalPass;

 

  return {

    ...scenario,

    dailyEnergy,

    annualEnergy,

    annualCharge,

    annualEfficiencyLoss,

    homeWeightedTariff,

    csRetailWeightedTariff,

    csGridPurchaseWeightedTariff,

    chargingTariff,

    annualChargingCost,

    annualDegradationCost,

    serviceFeeRate,

    annualServiceFee,

    pvFactor,

    ownerCapital,

    ownerAnnualOM,

    ownerAnnualizedCapital,

    ownerAnnualFixedCost,

    ownerAnnualVariableCost,

    ownerTotal,

    prosumerBEP,

    ownerValue,

    ownerValueMargin,

    ownerValuePass,

    utilityCapex,

    utilityOM,

    adminRate,

    utilityAnnualizedCapital,

    utilityAnnualFixedCost,

    utilityChargingMargin,

    annualChargingCostShortfall,

    utilityAdminCost,

    utilityAnnualNetVariableCost,

    utilityAnnualCostForBEP,

    utilityCostBEP,

    annualAvoidedResourceBenefit,

    grossUtilityValue,

    utilityBaseEconomicCeiling,

    economicGap,

    economicIntervalPass,

    // Compatibility alias used by the small result chart.

    utilityBEP: utilityBaseEconomicCeiling,

    gap: economicGap,

    viable,

  };

}

 

function durationHours(start, end) {

  const parse = (value) => {

    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value || "").trim());

    if (!match) return null;

    return Number(match[1]) * 60 + Number(match[2]);

  };

  const startMinutes = parse(start);

  const endMinutes = parse(end);

  if (startMinutes === null || endMinutes === null) return null;

  let difference = endMinutes - startMinutes;

  if (difference < 0) difference += 24 * 60;

  return difference / 60;

}

 

function Field({

  label,

  value,

  onChangeText,

  suffix,

  keyboardType = "numeric",

  secureTextEntry = false,

  placeholder = "Enter value",

  editable = true,

}) {

  return (

    <View style={styles.field}>

      <Text style={styles.fieldLabel}>{label}</Text>

      <View style={[styles.inputWrap, !editable && styles.inputDisabled]}>

        <TextInput

          value={String(value ?? "")}

          onChangeText={onChangeText}

          keyboardType={keyboardType}

          secureTextEntry={secureTextEntry}

          placeholder={placeholder}

          placeholderTextColor="#687990"

          style={styles.input}

          autoCapitalize={keyboardType === "email-address" ? "none" : "words"}

          autoCorrect={keyboardType !== "email-address"}

          blurOnSubmit={false}

          underlineColorAndroid="transparent"

          selectionColor={C.teal}

          editable={editable}

        />

        {!!suffix && <Text style={styles.suffix}>{suffix}</Text>}

      </View>

    </View>

  );

}

 

function Button({ title, onPress, secondary = false, disabled = false }) {

  return (

    <TouchableOpacity

      activeOpacity={0.82}

      onPress={onPress}

      disabled={disabled}

      style={[

        styles.button,

        secondary && styles.buttonSecondary,

        disabled && styles.buttonDisabled,

      ]}

    >

      <Text

        style={[

          styles.buttonText,

          secondary && styles.buttonSecondaryText,

          disabled && styles.buttonDisabledText,

        ]}

      >

        {title}

      </Text>

    </TouchableOpacity>

  );

}

 

function Card({ children, style }) {

  return <View style={[styles.card, style]}>{children}</View>;

}

 

function Heading({ title, subtitle }) {

  return (

    <View style={styles.headingBlock}>

      <Text style={styles.heading}>{title}</Text>

      {!!subtitle && <Text style={styles.muted}>{subtitle}</Text>}

    </View>

  );

}

 

function Metric({ label, value, color = C.text }) {

  return (

    <View style={styles.metric}>

      <Text style={styles.metricLabel}>{label}</Text>

      <Text style={[styles.metricValue, { color }]}>{value}</Text>

    </View>

  );

}

 

function DetailRow({ label, value, valueColor = C.text }) {

  return (

    <View style={styles.detailRow}>

      <Text style={styles.detailLabel}>{label}</Text>

      <Text style={[styles.detailValue, { color: valueColor }]}>{value}</Text>

    </View>

  );

}

 

function ReadOnlyTariff({ label, value, time }) {

  return (

    <View style={styles.tariffRow}>

      <View style={{ flex: 1 }}>

        <Text style={styles.tariffName}>{label}</Text>

        {!!time && <Text style={styles.tariffTime}>{time}</Text>}

      </View>

      <Text style={styles.tariffValue}>Rs. {Number(value).toFixed(2)}/kWh</Text>

    </View>

  );

}

 

function BarChart({ results }) {

  const max = Math.max(

    1,

    ...results.map((item) => Math.max(item.prosumerBEP, item.utilityBaseEconomicCeiling))

  );

  return (

    <View style={styles.chart}>

      {results.map((item) => (

        <View key={item.id} style={styles.barGroup}>

          <Text style={styles.chartLabel}>{item.id}</Text>

          <View style={styles.barPair}>

            <View style={styles.barTrack}>

              <View

                style={[

                  styles.bar,

                  {

                    height: Math.max(3, (120 * item.prosumerBEP) / max),

                    backgroundColor: C.teal,

                  },

                ]}

              />

            </View>

            <View style={styles.barTrack}>

              <View

                style={[

                  styles.bar,

                  {

                    height: Math.max(3, (120 * item.utilityBaseEconomicCeiling) / max),

                    backgroundColor: C.blue,

                  },

                ]}

              />

            </View>

          </View>

          <Text style={[styles.chartStatus, { color: item.viable ? C.green : C.red }]}>

            {item.viable ? "Eligible" : "Not eligible"}

          </Text>

        </View>

      ))}

    </View>

  );

}

export default function App() {

  // Continuous plasma motion behind every screen. The JS driver is used for consistent Expo Go device rendering; isInteraction:false keeps animations from blocking scrolling.

  const plasmaPulse = useRef(new Animated.Value(0)).current;

  const plasmaDrift = useRef(new Animated.Value(0)).current;

 

  useEffect(() => {

    const pulseLoop = Animated.loop(

      Animated.sequence([

        Animated.timing(plasmaPulse, { toValue: 1, duration: 2600, useNativeDriver: true, isInteraction: false }),

        Animated.timing(plasmaPulse, { toValue: 0, duration: 2600, useNativeDriver: true, isInteraction: false }),

      ])

    );

    const driftLoop = Animated.loop(

      Animated.sequence([

        Animated.timing(plasmaDrift, { toValue: 1, duration: 9000, useNativeDriver: true, isInteraction: false }),

        Animated.timing(plasmaDrift, { toValue: 0, duration: 9000, useNativeDriver: true, isInteraction: false }),

      ])

    );

    pulseLoop.start();

    driftLoop.start();

    return () => {

      pulseLoop.stop();

      driftLoop.stop();

    };

  }, [plasmaPulse, plasmaDrift]);

 

  const [screen, setScreen] = useState("welcome");

  const [role, setRole] = useState("Customer");

 

  // Registration / profile information

  const [fullName, setFullName] = useState("");

  const [initials, setInitials] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [mobile, setMobile] = useState("");

  const [account, setAccount] = useState(null);

 

  // Login

  const [loginEmail, setLoginEmail] = useState("");

  const [loginPassword, setLoginPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [error, setError] = useState("");

 

  // Model parameters and calculated results

  const [inputs, setInputs] = useState(DEFAULTS);

  const [results, setResults] = useState(null);

  const [selectedScenario, setSelectedScenario] = useState("S1");

 

  // Customer transaction calculator and in-session history

  const [session, setSession] = useState(DEFAULT_SESSION);

  const [sessionResult, setSessionResult] = useState(null);

  const [sessionHistory, setSessionHistory] = useState([]);

 

  // Restore only the registered account. Registration fields and the

  // opening screen are deliberately never restored, so a fresh launch

  // always starts at Welcome with a blank Create Account form.

  useEffect(() => {

    let active = true;

    const restoreAccount = async () => {

      try {

        // Remove the older draft that could incorrectly pre-fill registration.

        await AsyncStorage.removeItem("ev-energy-advisor-local-draft-v2");

        const savedAccount = await AsyncStorage.getItem("ev-energy-advisor-account-v3");

        if (active && savedAccount) {

          const parsedAccount = JSON.parse(savedAccount);

          if (parsedAccount && typeof parsedAccount.email === "string") {

            setAccount(parsedAccount);

          }

        }

      } catch (restoreError) {

        console.log("Could not restore registered account:", restoreError);

      }

    };

    restoreAccount();

    return () => { active = false; };

  }, []);

 

  useEffect(() => {

    const saveAccount = async () => {

      try {

        if (account) {

          await AsyncStorage.setItem("ev-energy-advisor-account-v3", JSON.stringify(account));

        }

      } catch (saveError) {

        console.log("Could not save registered account:", saveError);

      }

    };

    saveAccount();

  }, [account]);

 

 

  const update = (key, value) => {

    setInputs((old) => ({ ...old, [key]: value }));

    setResults(null);

  };

 

  const updateSession = (key, value) => {

    setSession((old) => ({ ...old, [key]: value }));

    setSessionResult(null);

  };

 

  const calculated = useMemo(() => results || [], [results]);

  const eligibleResults = useMemo(

    () => calculated.filter((item) => item.viable).sort((a, b) => (b.ownerValueMargin - a.ownerValueMargin) || (b.economicGap - a.economicGap)),

    [calculated]

  );

  const best = eligibleResults.length ? eligibleResults[0] : null;

  const secondary = eligibleResults.length > 1 ? eligibleResults[1] : null;

  const selected = calculated.find((item) => item.id === selectedScenario);

 

  const validateRegistration = () => {

    if (!fullName.trim()) return "Please enter your full name.";

    if (!initials.trim()) return "Please enter your initials with name.";

    if (!email.trim() || !email.includes("@") || !email.includes(".")) {

      return "Please enter a valid email address.";

    }

    if (password.length < 6) return "Password must contain at least 6 characters.";

    if (mobile.trim().length < 9) return "Please enter a valid mobile number.";

    if (email.trim().toLowerCase() === CONTROL_OFFICER_EMAIL) {

      return "This email is reserved for the pre-registered Control Officer.";

    }

    return "";

  };

 

  // Validate the customer's Day and Off-peak energy quantities in kWh/day.

  const validateInputs = () => {

    const positiveKeys = ["battery", "dailyEnergy", "efficiency", "operatingDays", "lifetime"];

 

    for (const key of positiveKeys) {

      if (num(inputs[key]) <= 0) {

        return `Please enter a positive value for ${key}.`;

      }

    }

 

    if (num(inputs.efficiency) > 100) {

      return "Efficiency cannot be greater than 100%.";

    }

 

    if (num(inputs.dailyEnergy) > num(inputs.battery)) {

      return "Daily discharged energy cannot exceed the battery capacity.";

    }

 

    const dayKwh = num(inputs.dayKwh);

    const offPeakKwh = num(inputs.offPeakKwh);

 

    if (dayKwh < 0 || offPeakKwh < 0) {

      return "Day and Off-peak charging quantities cannot be negative.";

    }

 

    if (dayKwh + offPeakKwh <= 0) {

      return "Enter a positive Day and/or Off-peak charging quantity.";

    }

 

    const efficiency = num(inputs.efficiency) / 100;

    const requiredChargingKwh = num(inputs.dailyEnergy) / efficiency;

    const enteredChargingKwh = dayKwh + offPeakKwh;

    const tolerance = Math.max(0.05, requiredChargingKwh * 0.005);

 

    if (Math.abs(enteredChargingKwh - requiredChargingKwh) > tolerance) {

      return `Day + Off-peak charging must total approximately ${fmt2(requiredChargingKwh)} kWh/day for your daily discharged energy and efficiency.`;

    }

 

    const nonNegativeKeys = [

      "homeDayTariff", "homeOffPeakTariff", "csRetailDayTariff", "csRetailOffPeakTariff",

      "csGridDayTariff", "csGridOffPeakTariff", "utilityChargingCostRate",

      "v2gOwnerValue", "v2hOwnerValue", "batteryDegradation", "stationServiceFee",

      "v2gHomeCapex", "v2gHomeOM", "v2hUnitCapex", "v2hAnnualOM",

      "baseAvoidedResourceValue", "utilityFactor", "discountRate", "escalation",

      "v2gUtilityCapex", "v2gUtilityOM", "v2gAdminCost",

      "v2hUtilityCapex", "v2hUtilityOM", "v2hAdminCost",

    ];

 

    if (nonNegativeKeys.some((key) => num(inputs[key]) < 0)) {

      return "Cost, tariff and value inputs cannot be negative.";

    }

 

    return "";

  };

 

  const createAccount = () => {

    const problem = validateRegistration();

    if (problem) {

      setError(problem);

      return;

    }

 

    const newAccount = {

      fullName: fullName.trim(),

      initials: initials.trim(),

      email: email.trim().toLowerCase(),

      password,

      mobile: mobile.trim(),

      role,

    };

 

    setAccount(newAccount);

    setError("");

    setScreen("dashboard");

  };

 

  const login = () => {

    if (!loginEmail.trim() || !loginPassword) {

      setError("Please enter your email address and password.");

      return;

    }

 

    // Pre-registered Control Officer account (demo only).

    if (

      loginEmail.trim().toLowerCase() === CONTROL_OFFICER_EMAIL &&

      loginPassword === CONTROL_OFFICER_PASSWORD

    ) {

      const controlAccount = {

        fullName: "Control Officer",

        initials: "CO",

        email: CONTROL_OFFICER_EMAIL,

        password: CONTROL_OFFICER_PASSWORD,

        mobile: "",

        role: "Control Officer",

      };

 

      // Do not overwrite a separately registered Customer/Utility Officer account.

      setFullName(controlAccount.fullName);

      setInitials(controlAccount.initials);

      setEmail(controlAccount.email);

      setMobile("");

      setRole("Control Officer");

      setError("");

      setScreen("dashboard");

      return;

    }

 

    if (!account || account.role === "Control Officer") {

      setError("No matching customer or utility officer account is available in this app session. Create an account first or use the Control Officer login.");

      return;

    }

 

    if (

      loginEmail.trim().toLowerCase() !== account.email ||

      loginPassword !== account.password

    ) {

      setError("Incorrect email address or password.");

      return;

    }

 

    setFullName(account.fullName);

    setInitials(account.initials);

    setEmail(account.email);

    setMobile(account.mobile);

    setRole(account.role);

    setError("");

    setScreen("dashboard");

  };

 

  const signOut = () => {

    setResults(null);

    setError("");

    setLoginEmail("");

    setLoginPassword("");

    setRole("Customer");

    setScreen("welcome");

  };

 

  const findBest = () => {

    const problem = validateInputs();

    if (problem) {

      setError(problem);

      return;

    }

 

    const output = SCENARIOS.map((scenario) => calculate(inputs, scenario));

    const ranked = output

      .filter((item) => item.viable)      .sort((a, b) => (b.ownerValueMargin - a.ownerValueMargin) || (b.economicGap - a.economicGap));

 

    setResults(output);

    setSelectedScenario(ranked[0]?.id || "S6");

    setError("");

    setScreen("results");

  };

 

  const calculateSession = () => {

    const peak = num(session.chargePeak);

    const day = num(session.chargeDay);

    const offPeak = num(session.chargeOffPeak);

    const discharge = num(session.dischargeUnits);

 

    if ([peak, day, offPeak, discharge].some((value) => value < 0)) {

      setError("Energy units cannot be negative.");

      return;

    }

 

    if (peak + day + offPeak <= 0) {

      setError("Enter at least some charging energy units.");

      return;

    }

 

    if (discharge <= 0) {

      setError("Enter the discharged energy units.");

      return;

    }

 

    const sessionDayRate = session.chargeSource === "Home"

      ? num(inputs.homeDayTariff)

      : num(inputs.csRetailDayTariff);

 

    const sessionOffPeakRate = session.chargeSource === "Home"

      ? num(inputs.homeOffPeakTariff)

      : num(inputs.csRetailOffPeakTariff);

 

    const chargingCost =

      peak * num(inputs.peakTariff) +

      day * sessionDayRate +

      offPeak * sessionOffPeakRate;

 

    const chargeHours = durationHours(session.chargeStart, session.chargeEnd);

    const dischargeHours = durationHours(session.dischargeStart, session.dischargeEnd);

 

    if (chargeHours === null || dischargeHours === null) {

      setError("Enter valid times in 24-hour format, for example 22:30.");

      return;

    }

 

    const isV2G = session.dischargeMode === "V2G";

    const benefit = discharge * num(isV2G ? inputs.v2gOwnerValue : inputs.v2hOwnerValue);

 

    setSessionResult({

      chargingUnits: peak + day + offPeak,

      chargeSource: session.chargeSource,

      peak,

      day,

      offPeak,

      chargingCost,

      discharge,

      benefit,

      net: benefit - chargingCost,

      chargeHours,

      dischargeHours,

      mode: session.dischargeMode,

      calculatedAt: new Date().toLocaleString(),

    });

 

    setError("");

  };

 

  const saveSession = () => {

    if (!sessionResult) return;

    setSessionHistory((old) => [sessionResult, ...old].slice(0, 10));

    Alert.alert("Session saved", "This transaction summary has been saved in the current app session.");

  };

 

  const renderHeader = () => (

    <View style={styles.header}>

      <View>

        <Text style={styles.brand}>EV ENERGY ADVISOR</Text>

        <Text style={styles.headerSub}>V2G & V2H ANALYSIS PLATFORM</Text>

      </View>

      <View style={styles.roleBadge}>

        <Text style={styles.roleBadgeText}>{role.toUpperCase()}</Text>

      </View>

    </View>

  );

 

  const renderWelcome = () => (

    <SafeAreaView style={styles.safe}>

      <ScrollView contentContainerStyle={styles.welcomeContent} showsVerticalScrollIndicator={false}>

        <View style={styles.welcomeLogo}>

          <Text style={styles.welcomeLogoText}>EV</Text>

          <Text style={styles.logoBolt}>⚡</Text>

          <View style={styles.logoDot} />

        </View>

        <Text style={styles.welcomeSmall}>SMART ENERGY · SMARTER MOBILITY</Text>

        <Text style={styles.welcomeMainTitle}>Welcome to</Text>

        <Text style={styles.welcomeAppTitle}>EV Energy Advisor</Text>

        <Text style={styles.welcomeDescription}>

          Discover smarter ways to manage your electric vehicle energy. Explore Vehicle-to-Grid and Vehicle-to-Home opportunities through economic analysis and energy-session calculations.

        </Text>

        <View style={styles.welcomeFeatures}>

          <View style={styles.welcomeFeature}>

            <Text style={styles.welcomeFeatureIcon}>⚡</Text>

            <Text style={styles.welcomeFeatureTitle}>V2G Analysis</Text>

            <Text style={styles.welcomeFeatureText}>Vehicle to Grid</Text>

          </View>

          <View style={styles.welcomeFeature}>

            <Text style={styles.welcomeFeatureIcon}>⚡</Text>

            <Text style={styles.welcomeFeatureTitle}>V2H Analysis</Text>

            <Text style={styles.welcomeFeatureText}>Vehicle to Home</Text>

          </View>

          <View style={styles.welcomeFeature}>

            <Text style={styles.welcomeFeatureIcon}>⚡</Text>

            <Text style={styles.welcomeFeatureTitle}>BEP Results</Text>

            <Text style={styles.welcomeFeatureText}>Six scenarios</Text>

          </View>

        </View>

        <View style={styles.welcomeActions}>

          <Text style={styles.welcomeActionTitle}>Get started</Text>

          <Text style={styles.welcomeActionSubtitle}>Sign in to your account or create a new one.</Text>

          <Button title="Login to your account →" onPress={() => { setError(""); setScreen("login"); }} />

          <Button title="Create a new account" secondary onPress={() => { setError(""); setScreen("register"); }} />

        </View>

        <Text style={styles.loginFooter}>EV ENERGY ADVISOR · V2G · V2H</Text>

      </ScrollView>

    </SafeAreaView>

  );

 

  const renderLogin = () => (    <SafeAreaView style={styles.safe}>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

        <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="always" keyboardDismissMode="none" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={styles.backButton} onPress={() => { setError(""); setScreen("welcome"); }}>

            <Text style={styles.backButtonText}>‹ Back</Text>

          </TouchableOpacity>

          <View style={styles.loginLogo}><Text style={styles.loginLogoText}>EV</Text></View>

          <Text style={styles.loginTitle}>Welcome back!</Text>

          <Text style={styles.loginSubtitle}>Login to continue to your EV Energy Advisor.</Text>

          <Card>

            <Text style={styles.cardTitle}>Login to your account</Text>

            <Field label="Email address" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" placeholder="name@example.com" />

            <View style={styles.field}>

              <Text style={styles.fieldLabel}>Password</Text>

              <View style={styles.passwordRow}>

                <TextInput value={loginPassword} onChangeText={setLoginPassword} placeholder="Enter your password" placeholderTextColor="#687990" secureTextEntry={!showLoginPassword} autoCapitalize="none" autoCorrect={false} blurOnSubmit={false} selectionColor={C.teal} style={styles.passwordInput} />

                <TouchableOpacity onPress={() => setShowLoginPassword((value) => !value)}>

                  <Text style={styles.showPassword}>{showLoginPassword ? "HIDE" : "SHOW"}</Text>

                </TouchableOpacity>

              </View>

            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Button title="Login" onPress={login} />

            <View style={styles.divider} />

            <Text style={styles.mutedCenter}>Don't have an account yet?</Text>

            <Button title="Create an account" secondary onPress={() => { setError(""); setScreen("register"); }} />

            <Text style={styles.smallNote}>Control Officer access is pre-registered. It is not available through public registration.</Text>

          </Card>

          <Text style={styles.loginFooter}>EV ENERGY ADVISOR · V2G · V2H</Text>

        </ScrollView>

      </KeyboardAvoidingView>

    </SafeAreaView>

  );

 

  const renderRegister = () => (

    <SafeAreaView style={styles.safe}>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

        <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="always" keyboardDismissMode="none" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={styles.backButton} onPress={() => { setError(""); setScreen("welcome"); }}>

            <Text style={styles.backButtonText}>‹ Back</Text>

          </TouchableOpacity>

          <View style={styles.loginLogo}><Text style={styles.loginLogoText}>EV</Text></View>

          <Text style={styles.loginTitle}>Create your account</Text>

          <Text style={styles.loginSubtitle}>Join the EV Energy Advisor platform.</Text>

          <Card>

            <Text style={styles.cardTitle}>Profile information</Text>

            <Field label="Full name" value={fullName} onChangeText={setFullName} keyboardType="default" placeholder="Enter your full name" />

            <Field label="Initials with name" value={initials} onChangeText={setInitials} keyboardType="default" placeholder="Example: I. M. Mohamed" />

            <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="name@example.com" />

            <View style={styles.field}>

              <Text style={styles.fieldLabel}>Password</Text>

              <View style={styles.passwordRow}>

                <TextInput value={password} onChangeText={setPassword} placeholder="Create a password" placeholderTextColor="#687990" secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} blurOnSubmit={false} selectionColor={C.teal} style={styles.passwordInput} />

                <TouchableOpacity onPress={() => setShowPassword((value) => !value)}>

                  <Text style={styles.showPassword}>{showPassword ? "HIDE" : "SHOW"}</Text>

                </TouchableOpacity>

              </View>

            </View>

            <Field label="Mobile number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="Enter mobile number" />

            <View style={styles.divider} />

            <Text style={styles.cardTitle}>Select your account type</Text>

            <Text style={styles.muted}>Control Officer accounts are pre-registered and cannot be self-created.</Text>

            <TouchableOpacity style={[styles.roleCard, role === "Customer" && styles.roleCardActive]} onPress={() => setRole("Customer")}>

              <Text style={styles.roleCardIcon}>🚗</Text>

              <View style={{ flex: 1 }}>

                <Text style={styles.roleCardTitle}>EV Customer</Text>

                <Text style={styles.roleCardDescription}>EV details, TOU charging costs, V2G/V2H options, personal BEP analysis and energy sessions.</Text>

              </View>

              <Text style={styles.radioText}>{role === "Customer" ? "●" : "○"}</Text>

            </TouchableOpacity>

            <TouchableOpacity style={[styles.roleCard, role === "Utility Officer" && styles.roleCardActive]} onPress={() => setRole("Utility Officer")}>

              <Text style={styles.roleCardIcon}>⚡</Text>

              <View style={{ flex: 1 }}>

                <Text style={styles.roleCardTitle}>Utility Officer</Text>

                <Text style={styles.roleCardDescription}>Full technical and financial inputs, tariff updates and detailed six-scenario BEP calculations.</Text>

              </View>

              <Text style={styles.radioText}>{role === "Utility Officer" ? "●" : "○"}</Text>

            </TouchableOpacity>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Button title="Create account and continue →" onPress={createAccount} />

            <View style={styles.divider} />

            <Text style={styles.mutedCenter}>Already have an account?</Text>

            <Button title="Login instead" secondary onPress={() => { setError(""); setScreen("login"); }} />

          </Card>

          <Text style={styles.loginFooter}>EV ENERGY ADVISOR · V2G · V2H</Text>

        </ScrollView>

      </KeyboardAvoidingView>

    </SafeAreaView>

  );

 

  const renderDashboard = () => (

    <>

      {renderHeader()}

      <View style={styles.welcomeBanner}>

        <Text style={styles.eyebrow}>WELCOME</Text>

        <View style={styles.welcomeRow}>

          <View style={{ flex: 1 }}>

            <Text style={styles.welcomeTitle}>Hello, {fullName.trim().split(" ")[0] || "there"}!</Text>

            <Text style={styles.welcomeDescription}>

              {role === "Customer"

                ? "Explore your EV energy, charging costs and potential V2G/V2H benefits."

                : role === "Utility Officer"

                ? "Review all technical, financial and utility-side assumptions."

                : "Manage approved tariff assumptions for the platform."}

            </Text>

          </View>

          <View style={styles.smallProfile}><Text style={styles.smallProfileText}>{(initials || "E").charAt(0).toUpperCase()}</Text></View>

        </View>

        <View style={styles.bannerFooter}>

          <Text style={styles.bannerCaption}>ENERGY ANALYSIS</Text>

          <Text style={styles.readyCaption}>✓ READY</Text>

        </View>

      </View>

 

      <Heading title={role === "Customer" ? "Your EV overview" : role === "Utility Officer" ? "Utility overview" : "Control workspace"} subtitle="Your EV Energy Advisor workspace." />

      <View style={styles.overviewGrid}>

        <View style={styles.overviewCard}><Text style={styles.overviewIcon}>🔋</Text><Text style={styles.overviewLabel}>Battery capacity</Text><Text style={styles.overviewValue}>{inputs.battery} kWh</Text></View>

        <View style={styles.overviewCard}><Text style={styles.overviewIcon}>⚡</Text><Text style={styles.overviewLabel}>Daily discharged energy</Text><Text style={styles.overviewValue}>{inputs.dailyEnergy} kWh</Text></View>

        <View style={styles.overviewCard}><Text style={styles.overviewIcon}>📊</Text><Text style={styles.overviewLabel}>Scenarios</Text><Text style={styles.overviewValue}>06</Text></View>        <View style={styles.overviewCard}><Text style={styles.overviewIcon}>🗓️</Text><Text style={styles.overviewLabel}>Lifetime</Text><Text style={styles.overviewValue}>{inputs.lifetime} years</Text></View>

      </View>

 

      {role === "Customer" && (

        <Card>

          <Text style={styles.cardTitle}>Your current research tariff defaults</Text>

          <ReadOnlyTariff

            label="Home weighted tariff"

            value={weightedTariff(inputs.homeDayTariff, inputs.homeOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh)}

            time={`${fmt2(inputs.dayKwh)} kWh Day + ${fmt2(inputs.offPeakKwh)} kWh Off-peak`}

          />

          <ReadOnlyTariff

            label="CS retail weighted tariff"

            value={weightedTariff(inputs.csRetailDayTariff, inputs.csRetailOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh)}

            time={`${fmt2(inputs.dayKwh)} kWh Day + ${fmt2(inputs.offPeakKwh)} kWh Off-peak`}

          />

          <Text style={styles.smallNote}>The six-scenario BEP calculation uses your Day and Off-peak charging quantities in kWh/day. Tariff rates remain controlled by authorised officers.</Text>

        </Card>

      )}

 

      <Card>

        <Text style={styles.cardTitle}>{role === "Customer" ? "Your energy opportunities" : role === "Utility Officer" ? "Utility analysis workspace" : "Tariff control workspace"}</Text>

        <Text style={styles.muted}>

          {role === "Customer"

            ? "Compare the six operating scenarios, estimate your charging cost and explore V2G income or V2H bill savings."

            : role === "Utility Officer"

            ? "Configure customer and utility assumptions, edit tariffs and inspect every calculation behind the BEP comparison."

            : "Update the tariff values used by customer estimates and scenario calculations."}

        </Text>

        <View style={styles.featurePillRow}><Text style={styles.featurePill}>V2G</Text><Text style={styles.featurePill}>V2H</Text><Text style={styles.featurePill}>BEP analysis</Text></View>

        <Button title={role === "Customer" ? "Enter EV details →" : role === "Utility Officer" ? "Open full model inputs →" : "Manage tariffs →"} onPress={() => setScreen(role === "Control Officer" ? "tariffs" : "inputs")} />

      </Card>

 

      <Heading title="Quick access" />

      {[

        ...(role === "Customer" ? [["⚡", "Energy session calculator", "Calculate charging payments and V2G/V2H benefits.", "session"]] : []),

        ["🚗", role === "Customer" ? "EV and cost inputs" : "Technical and financial inputs", "Configure analysis parameters.", "inputs"],

        ["📊", "Six operating scenarios", "Explore V2G and V2H routes.", "scenarios"],

        ...(role !== "Customer" ? [["💡", "Tariff management", "Update approved tariff assumptions.", "tariffs"]] : []),

        ["📘", "User guide", "Learn how to use each feature.", "guide"],

        ["👤", "My profile", "View your account details.", "profile"],

      ].map(([icon, title, subtitle, target]) => (

        <TouchableOpacity key={target} style={styles.actionCard} onPress={() => setScreen(target)}>

          <Text style={styles.actionIcon}>{icon}</Text>

          <View style={{ flex: 1 }}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionSubtitle}>{subtitle}</Text></View>

          <Text style={styles.arrow}>›</Text>

        </TouchableOpacity>

      ))}

    </>

  );

 

  const renderInputs = () => {

    const isUtility = role === "Utility Officer";

    const requiredDailyCharging = num(inputs.efficiency) > 0

      ? num(inputs.dailyEnergy) / (num(inputs.efficiency) / 100)

      : 0;

    const enteredDailyCharging = num(inputs.dayKwh) + num(inputs.offPeakKwh);

 

    return (

      <>

        {renderHeader()}

        <Heading title={role === "Customer" ? "EV & Research Inputs" : "Complete Research Model Inputs"} subtitle={role === "Customer" ? "Enter your own Day and Off-peak charging energy in kWh/day. Tariff rates are read-only." : "Edit the assumptions used by the six-scenario workbook-aligned BEP model."} />

        <Card>

          <Text style={styles.cardTitle}>01 · Common technical assumptions</Text>

          <Field label="Battery capacity" value={inputs.battery} suffix="kWh" onChangeText={(v) => update("battery", v)} />

          <Field label="Daily discharged energy" value={inputs.dailyEnergy} suffix="kWh/day" onChangeText={(v) => update("dailyEnergy", v)} />

          <Field label="Round-trip efficiency" value={inputs.efficiency} suffix="%" onChangeText={(v) => update("efficiency", v)} />

          <Field label="Operating days per year" value={inputs.operatingDays} suffix="days/year" onChangeText={(v) => update("operatingDays", v)} />

          <Field label="Project lifetime" value={inputs.lifetime} suffix="years" onChangeText={(v) => update("lifetime", v)} />

          <Field label="Discount rate" value={inputs.discountRate} suffix="%" onChangeText={(v) => update("discountRate", v)} editable={isUtility} />

          <Field label="Annual escalation" value={inputs.escalation} suffix="%" onChangeText={(v) => update("escalation", v)} editable={isUtility} />

          <View style={styles.infoPanel}>

            <Text style={styles.infoPanelTitle}>Escalating present-value factor</Text>

            <Text style={styles.muted}>PVF = Σ [(1 + escalation)^(t−1) ÷ (1 + discount rate)^t]. Current value: {fmt9(escalatingPVFactor(inputs.discountRate, inputs.escalation, inputs.lifetime))}. Initial workbook value: 4.002600114 for 5 years, 10% discount and 3% escalation.</Text>

          </View>

        </Card>

 

        <Card>

          <Text style={styles.cardTitle}>02 · Your daily charging-energy mix</Text>

          <Text style={styles.muted}>Enter the energy you plan to charge during each tariff period. These are energy quantities, not percentages. The two quantities should equal the charging energy required to supply your daily discharged energy after efficiency losses.</Text>

          <Field label="Day charging energy" value={inputs.dayKwh} suffix="kWh/day" onChangeText={(v) => update("dayKwh", v)} />

          <Field label="Off-peak charging energy" value={inputs.offPeakKwh} suffix="kWh/day" onChangeText={(v) => update("offPeakKwh", v)} />

          <View style={styles.infoPanel}>

            <Text style={styles.infoPanelTitle}>Daily charging-energy check</Text>

            <DetailRow label="Required charging energy" value={`${fmt2(requiredDailyCharging)} kWh/day`} />

            <DetailRow label="Your entered charging energy" value={`${fmt2(enteredDailyCharging)} kWh/day`} />

            <DetailRow label="Difference" value={`${fmt2(enteredDailyCharging - requiredDailyCharging)} kWh/day`} valueColor={Math.abs(enteredDailyCharging - requiredDailyCharging) <= Math.max(0.05, requiredDailyCharging * 0.005) ? C.green : C.orange} />

            <Text style={styles.smallNote}>Required charging energy = Daily discharged energy ÷ Round-trip efficiency.</Text>

          </View>

          <Text style={styles.smallNote}>Example: with 20 kWh/day discharged energy and 90% efficiency, total charging energy is approximately 22.22 kWh/day. You may allocate this between Day and Off-peak.</Text>

        </Card>

 

        <Card>

          <Text style={styles.cardTitle}>03 · Weighted charging tariffs</Text>

          <Text style={styles.muted}>Tariff rates are set by the Utility Officer or Control Officer. Customers can view them but cannot edit them. Your kWh quantities above determine the weighted tariff automatically.</Text>

          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>Home tariff inputs</Text>

          <Field label="Home Day tariff" value={inputs.homeDayTariff} suffix="Rs./kWh" onChangeText={(v) => update("homeDayTariff", v)} editable={isUtility} />

          <Field label="Home Off-peak tariff" value={inputs.homeOffPeakTariff} suffix="Rs./kWh" onChangeText={(v) => update("homeOffPeakTariff", v)} editable={isUtility} />

          <DetailRow label="Calculated weighted Home tariff" value={`Rs. ${fmt2(weightedTariff(inputs.homeDayTariff, inputs.homeOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh))}/kWh`} />

          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>Charging-station retail tariff inputs</Text>

          <Field label="CS retail Day tariff" value={inputs.csRetailDayTariff} suffix="Rs./kWh" onChangeText={(v) => update("csRetailDayTariff", v)} editable={isUtility} />

          <Field label="CS retail Off-peak tariff" value={inputs.csRetailOffPeakTariff} suffix="Rs./kWh" onChangeText={(v) => update("csRetailOffPeakTariff", v)} editable={isUtility} />

          <DetailRow label="Calculated weighted CS retail tariff" value={`Rs. ${fmt2(weightedTariff(inputs.csRetailDayTariff, inputs.csRetailOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh))}/kWh`} />

          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>Utility grid-purchase tariff used for charging margin</Text>

          <Field label="Grid purchase Day tariff" value={inputs.csGridDayTariff} suffix="Rs./kWh" onChangeText={(v) => update("csGridDayTariff", v)} editable={isUtility} />

          <Field label="Grid purchase Off-peak tariff" value={inputs.csGridOffPeakTariff} suffix="Rs./kWh" onChangeText={(v) => update("csGridOffPeakTariff", v)} editable={isUtility} />

          <Field label="Utility charging-cost rate" value={inputs.utilityChargingCostRate} suffix="Rs./kWh" onChangeText={(v) => update("utilityChargingCostRate", v)} editable={isUtility} />

          <DetailRow label="Weighted grid-purchase tariff" value={`Rs. ${fmt2(weightedTariff(inputs.csGridDayTariff, inputs.csGridOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh))}/kWh`} />

        </Card>        <Card>

          <Text style={styles.cardTitle}>04 · Owner-value and degradation assumptions</Text>

          <Field label="V2G export / owner value" value={inputs.v2gOwnerValue} suffix="Rs./kWh" onChangeText={(v) => update("v2gOwnerValue", v)} editable={isUtility} />

          <Field label="V2H avoided household value" value={inputs.v2hOwnerValue} suffix="Rs./kWh" onChangeText={(v) => update("v2hOwnerValue", v)} editable={isUtility} />

          <Field label="Battery degradation cost" value={inputs.batteryDegradation} suffix="Rs./kWh discharged" onChangeText={(v) => update("batteryDegradation", v)} editable={isUtility} />

          <Field label="Charging-station route/service fee" value={inputs.stationServiceFee} suffix="Rs./kWh discharged" onChangeText={(v) => update("stationServiceFee", v)} editable={isUtility} />

        </Card>

        {isUtility && (

          <Card style={styles.utilityCard}>            <Text style={styles.utilityHeading}>UTILITY OFFICER · COST ASSUMPTIONS</Text>

            <Text style={styles.cardTitle}>05 · Owner CAPEX and O&M</Text>

            <Field label="V2G home interface CAPEX (S1 and S3)" value={inputs.v2gHomeCapex} suffix="Rs." onChangeText={(v) => update("v2gHomeCapex", v)} />

            <Field label="V2G home interface annual O&M (S1 and S3)" value={inputs.v2gHomeOM} suffix="Rs./year" onChangeText={(v) => update("v2gHomeOM", v)} />

            <Field label="V2H unit CAPEX (S5 and S6)" value={inputs.v2hUnitCapex} suffix="Rs." onChangeText={(v) => update("v2hUnitCapex", v)} />

            <Field label="V2H annual O&M (S5 and S6)" value={inputs.v2hAnnualOM} suffix="Rs./year" onChangeText={(v) => update("v2hAnnualOM", v)} />

            <View style={styles.divider} />

            <Text style={styles.cardTitle}>06 · Utility V2G cost assumptions (S1–S4)</Text>

            <Field label="Utility V2G CAPEX per customer" value={inputs.v2gUtilityCapex} suffix="Rs." onChangeText={(v) => update("v2gUtilityCapex", v)} />

            <Field label="Utility V2G annual O&M" value={inputs.v2gUtilityOM} suffix="Rs./year" onChangeText={(v) => update("v2gUtilityOM", v)} />

            <Field label="Utility V2G integration/admin cost" value={inputs.v2gAdminCost} suffix="Rs./kWh discharged" onChangeText={(v) => update("v2gAdminCost", v)} />

            <View style={styles.divider} />

            <Text style={styles.cardTitle}>07 · Utility V2H cost assumptions (S5–S6)</Text>

            <Field label="Utility V2H CAPEX per customer" value={inputs.v2hUtilityCapex} suffix="Rs." onChangeText={(v) => update("v2hUtilityCapex", v)} />

            <Field label="Utility V2H annual O&M" value={inputs.v2hUtilityOM} suffix="Rs./year" onChangeText={(v) => update("v2hUtilityOM", v)} />

            <Field label="Utility V2H integration/admin cost" value={inputs.v2hAdminCost} suffix="Rs./kWh discharged" onChangeText={(v) => update("v2hAdminCost", v)} />

            <View style={styles.divider} />

            <Text style={styles.cardTitle}>08 · Utility economic value</Text>

            <Field label="Base avoided-resource value" value={inputs.baseAvoidedResourceValue} suffix="Rs./kWh" onChangeText={(v) => update("baseAvoidedResourceValue", v)} />

            <Field label="Utility factor" value={inputs.utilityFactor} suffix="factor" onChangeText={(v) => update("utilityFactor", v)} />

          </Card>

        )}

        {!isUtility && (

          <Card>

            <Text style={styles.cardTitle}>Research reference values</Text>

            <DetailRow label="Battery degradation" value={`Rs. ${inputs.batteryDegradation}/kWh`} />

            <DetailRow label="V2G owner value" value={`Rs. ${inputs.v2gOwnerValue}/kWh`} />

            <DetailRow label="V2H avoided household value" value={`Rs. ${inputs.v2hOwnerValue}/kWh`} />

            <DetailRow label="Station service fee" value={`Rs. ${inputs.stationServiceFee}/kWh`} />

            <DetailRow label="Base avoided-resource value" value={`Rs. ${inputs.baseAvoidedResourceValue}/kWh`} />

          </Card>

        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.analysisPanel}>

          <Text style={styles.cardTitle}>Two independent viability tests</Text>

          <Text style={styles.bodyText}>Test A: Owner value ≥ Prosumer BEP.</Text>

          <Text style={styles.bodyText}>Test B: Utility BASE economic ceiling greater than Prosumer BEP.</Text>

          <Text style={styles.muted}>Utility COST BEP is shown separately and is not used as the BASE economic ceiling.</Text>

          <Button title="Calculate all six scenarios →" onPress={findBest} />

        </View>

      </>

    );

  };

 

  const renderTariffs = () => {

    if (role === "Customer") {

      return (

        <>

          <Heading title="Tariff Information" subtitle="Tariff rates are read-only for customers. Your own charging-energy quantities are entered in EV & Research Inputs." />

          <Card>

            <Text style={styles.cardTitle}>Your weighted tariff assumptions</Text>

            <DetailRow label="Day charging quantity" value={`${fmt2(inputs.dayKwh)} kWh/day`} />

            <DetailRow label="Off-peak charging quantity" value={`${fmt2(inputs.offPeakKwh)} kWh/day`} />

            <ReadOnlyTariff

              label="Home weighted tariff"

              value={weightedTariff(inputs.homeDayTariff, inputs.homeOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh)}

              time="Calculated using your kWh/day quantities"

            />

            <ReadOnlyTariff

              label="CS retail weighted tariff"

              value={weightedTariff(inputs.csRetailDayTariff, inputs.csRetailOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh)}

              time="Calculated using your kWh/day quantities"

            />

            <ReadOnlyTariff

              label="CS grid-purchase weighted tariff"

              value={weightedTariff(inputs.csGridDayTariff, inputs.csGridOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh)}

              time="Calculated using your kWh/day quantities"

            />

            <ReadOnlyTariff label="V2G owner value" value={inputs.v2gOwnerValue} />

            <ReadOnlyTariff label="V2H avoided household value" value={inputs.v2hOwnerValue} />

            <Text style={styles.smallNote}>Customers cannot change tariff rates. Weighted tariffs are recalculated automatically when the customer changes Day or Off-peak charging energy quantities.</Text>

          </Card>

        </>

      );

    }

 

    const requiredDailyCharging = num(inputs.efficiency) > 0

      ? num(inputs.dailyEnergy) / (num(inputs.efficiency) / 100)

      : 0;

 

    return (

      <>

        {renderHeader()}

        <Heading title="Tariff Management" subtitle="Utility Officer and Control Officer can manage tariff rates and default Day/Off-peak charging quantities." />

 

        <Card>

          <Text style={styles.cardTitle}>Default Day and Off-peak charging quantities</Text>

          <Text style={styles.muted}>Set the default energy allocation shown to customers. Enter actual energy quantities in kWh/day, not percentage shares.</Text>

          <Field label="Default Day charging quantity" value={inputs.dayKwh} suffix="kWh/day" onChangeText={(v) => update("dayKwh", v)} />

          <Field label="Default Off-peak charging quantity" value={inputs.offPeakKwh} suffix="kWh/day" onChangeText={(v) => update("offPeakKwh", v)} />

          <View style={styles.infoPanel}>

            <Text style={styles.infoPanelTitle}>Default charging-energy check</Text>

            <DetailRow label="Required daily charging energy" value={`${fmt2(requiredDailyCharging)} kWh/day`} />

            <DetailRow label="Default Day + Off-peak" value={`${fmt2(num(inputs.dayKwh) + num(inputs.offPeakKwh))} kWh/day`} />

            <Text style={styles.smallNote}>Required charging energy = daily discharged energy ÷ round-trip efficiency. The default quantities should add up to this value.</Text>

          </View>

        </Card>

 

        <Card>

          <Text style={styles.cardTitle}>Home electricity tariff</Text>

          <Field label="Home Day tariff" value={inputs.homeDayTariff} suffix="Rs./kWh" onChangeText={(v) => update("homeDayTariff", v)} />

          <Field label="Home Off-peak tariff" value={inputs.homeOffPeakTariff} suffix="Rs./kWh" onChangeText={(v) => update("homeOffPeakTariff", v)} />

          <DetailRow label="Weighted home tariff" value={`Rs. ${fmt2(weightedTariff(inputs.homeDayTariff, inputs.homeOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh))}/kWh`} />

        </Card>

 

        <Card>

          <Text style={styles.cardTitle}>Charging-station retail tariff</Text>

          <Field label="CS retail Day tariff" value={inputs.csRetailDayTariff} suffix="Rs./kWh" onChangeText={(v) => update("csRetailDayTariff", v)} />

          <Field label="CS retail Off-peak tariff" value={inputs.csRetailOffPeakTariff} suffix="Rs./kWh" onChangeText={(v) => update("csRetailOffPeakTariff", v)} />

          <DetailRow label="Weighted CS retail tariff" value={`Rs. ${fmt2(weightedTariff(inputs.csRetailDayTariff, inputs.csRetailOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh))}/kWh`} />

        </Card>

 

        <Card>

          <Text style={styles.cardTitle}>Utility grid-purchase tariff and charging margin</Text>

          <Field label="Grid purchase Day tariff" value={inputs.csGridDayTariff} suffix="Rs./kWh" onChangeText={(v) => update("csGridDayTariff", v)} />

          <Field label="Grid purchase Off-peak tariff" value={inputs.csGridOffPeakTariff} suffix="Rs./kWh" onChangeText={(v) => update("csGridOffPeakTariff", v)} />

          <Field label="Utility charging-cost rate" value={inputs.utilityChargingCostRate} suffix="Rs./kWh" onChangeText={(v) => update("utilityChargingCostRate", v)} />

          <DetailRow label="Weighted CS grid-purchase tariff" value={`Rs. ${fmt2(weightedTariff(inputs.csGridDayTariff, inputs.csGridOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh))}/kWh`} />

        </Card>

 

        <Card>

          <Text style={styles.cardTitle}>Owner values and utility ceiling</Text>

          <Field label="V2G owner export value" value={inputs.v2gOwnerValue} suffix="Rs./kWh" onChangeText={(v) => update("v2gOwnerValue", v)} />

          <Field label="V2H avoided household value" value={inputs.v2hOwnerValue} suffix="Rs./kWh" onChangeText={(v) => update("v2hOwnerValue", v)} />

          <Field label="Base avoided-resource value" value={inputs.baseAvoidedResourceValue} suffix="Rs./kWh" onChangeText={(v) => update("baseAvoidedResourceValue", v)} />

          <Field label="Utility factor" value={inputs.utilityFactor} suffix="factor" onChangeText={(v) => update("utilityFactor", v)} />

          <Button title="Save tariff assumptions for this app session" onPress={() => { setResults(null); Alert.alert("Assumptions updated", "These tariff and value assumptions will be used in future calculations in this app session."); }} />

        </Card>

      </>

    );

  };

 

  const renderScenarios = () => (

    <>

      {renderHeader()}

      <Heading title="Operating Scenarios" subtitle="The six routes are reproduced using the workbook's route-specific charging, capital, O&M and utility assumptions." />

      {SCENARIOS.map((scenario) => (

        <Card key={scenario.id}>

          <View style={styles.scenarioTop}>

            <Text style={styles.scenarioId}>{scenario.id}</Text>            <Text style={styles.scenarioType}>{scenario.type}</Text>

          </View>

          <Text style={styles.cardTitle}>{scenario.route}</Text>

          <Text style={styles.muted}>{scenario.description}</Text>

          <Text style={styles.scenarioFactor}>Charging tariff: {scenario.chargingSource === "Home" ? "Home weighted tariff" : "CS retail weighted tariff"}</Text>

          <Text style={styles.scenarioFactor}>Owner service fee: Rs. {scenario.serviceFee === 0 ? "0.00" : fmt2(inputs.stationServiceFee)}/kWh</Text>

        </Card>

      ))}

      <Card>

        <Text style={styles.cardTitle}>Important: two different utility measures</Text>

        <Text style={styles.bodyText}>Utility COST BEP = Utility annual fixed cost + Utility annual net variable cost, divided by annual discharged energy.</Text>

        <Text style={styles.bodyText}>Utility BASE economic ceiling = (Base avoided-resource value × utility factor) − Utility COST BEP.</Text>

        <Text style={styles.bodyText}>The workbook's economic gap compares Utility BASE economic ceiling with Prosumer BEP. It does not compare Utility COST BEP directly with Prosumer BEP.</Text>

      </Card>

    </>

  );

 

  const renderResults = () => {

    if (!calculated.length) {

      return (

        <>

          {renderHeader()}

          <Card>

            <Text style={styles.cardTitle}>No analysis results yet</Text>

            <Text style={styles.muted}>Enter your parameters and press Find the Best Scenario first.</Text>

            <Button title="Enter parameters" onPress={() => setScreen("inputs")} />

          </Card>

        </>

      );

    }

 

    return (

      <>

        {renderHeader()}

        <Heading title="BEP Analysis Results" subtitle="Workbook-aligned calculations for all six V2G/V2H routes." />

 

        <Card>

          <Text style={styles.cardTitle}>Common calculated values</Text>

          <DetailRow label="Annual discharged energy" value={`${fmt2(calculated[0].annualEnergy)} kWh/year`} />

          <DetailRow label="Annual charging energy" value={`${fmt2(calculated[0].annualCharge)} kWh/year`} />

          <DetailRow label="Annual efficiency loss" value={`${fmt2(calculated[0].annualEfficiencyLoss)} kWh/year`} />

          <DetailRow label="Day charging quantity" value={`${fmt2(inputs.dayKwh)} kWh/day`} />

          <DetailRow label="Off-peak charging quantity" value={`${fmt2(inputs.offPeakKwh)} kWh/day`} />

          <DetailRow label="Weighted home tariff" value={`Rs. ${fmt2(calculated[0].homeWeightedTariff)}/kWh`} />

          <DetailRow label="Weighted charging-station retail tariff" value={`Rs. ${fmt2(calculated[0].csRetailWeightedTariff)}/kWh`} />

          <DetailRow label="Weighted CS grid-purchase tariff" value={`Rs. ${fmt2(calculated[0].csGridPurchaseWeightedTariff)}/kWh`} />

          <DetailRow label="Escalating present-value factor" value={fmt9(calculated[0].pvFactor)} />

        </Card>

 

        {best ? (

          <Card style={styles.bestCard}>

            <Text style={styles.eyebrow}>PRIMARY CANDIDATE · PASSES BOTH TESTS</Text>

            <Text style={styles.bestId}>{best.id}</Text>

            <Text style={styles.cardTitle}>{best.type} · {best.route}</Text>

            <Text style={styles.bodyText}>The owner-value margin is Rs. {fmt2(best.ownerValueMargin)}/kWh and the utility economic gap is Rs. {fmt2(best.economicGap)}/kWh.</Text>

            <View style={styles.divider} />

            <View style={styles.metricRow}>

              <Metric label="Prosumer BEP" value={fmt2(best.prosumerBEP)} color={C.teal} />

              <Metric label="Owner value" value={fmt2(best.ownerValue)} color={C.blue} />

              <Metric label="Owner margin" value={fmt2(best.ownerValueMargin)} color={C.green} />

            </View>

            <Text style={styles.eligibilityText}>✓ Passes Test A and Test B.</Text>

            <Text style={styles.smallNote}>{secondary ? `Secondary candidate: ${secondary.id} · ${secondary.type} · owner-value margin Rs. ${fmt2(secondary.ownerValueMargin)}/kWh · economic gap Rs. ${fmt2(secondary.economicGap)}/kWh.` : "There is no second eligible candidate under the current inputs."}</Text>

          </Card>

        ) : (

          <Card style={styles.warningCard}>

            <Text style={styles.warningTitle}>No scenario passes both tests</Text>

            <Text style={styles.bodyText}>A scenario must satisfy both: (A) owner value ≥ Prosumer BEP, and (B) Utility BASE economic ceiling greater than Prosumer BEP.</Text>

            <Text style={styles.muted}>Utility COST BEP is displayed separately and is not the economic ceiling used in Test B.</Text>

          </Card>

        )}

 

        <Card>

          <Text style={styles.cardTitle}>Prosumer BEP and Utility BASE economic ceiling</Text>

          <View style={styles.legend}><Text style={styles.legendTeal}>● Prosumer BEP</Text><Text style={styles.legendBlue}>■ Utility BASE ceiling</Text></View>

          <BarChart results={calculated} />

          <Text style={styles.chartNote}>The utility BASE ceiling is (base avoided-resource value × utility factor) − Utility COST BEP. Test B compares this ceiling with Prosumer BEP.</Text>

        </Card>

 

        <Card>

          <Text style={styles.cardTitle}>Consolidated six-scenario results</Text>

          {calculated.map((item) => (

            <TouchableOpacity key={item.id} style={[styles.resultRow, selectedScenario === item.id && styles.resultSelected]} onPress={() => setSelectedScenario(item.id)}>

              <View style={{ flex: 1 }}>

                <Text style={styles.resultId}>{item.id} · {item.type}</Text>

                <Text style={styles.muted}>{item.route}</Text>

                <Text style={[styles.resultStatus, { color: item.viable ? C.green : C.red }]}>{item.viable ? "PASSES BOTH TESTS" : "DOES NOT PASS BOTH"}</Text>

              </View>

              <View style={{ alignItems: "flex-end" }}>

                <Text style={styles.resultTeal}>Owner BEP: {fmt2(item.prosumerBEP)}</Text>

                <Text style={styles.resultBlue}>Cost BEP: {fmt2(item.utilityCostBEP)}</Text>

                <Text style={styles.resultBlue}>Base ceiling: {fmt2(item.utilityBaseEconomicCeiling)}</Text>

                <Text style={[styles.resultGap, { color: item.economicGap > 0 ? C.green : C.red }]}>Gap: {item.economicGap >= 0 ? "+" : ""}{fmt2(item.economicGap)}</Text>

                <Text style={[styles.chartNote, { marginTop: 3, textAlign: "right" }]}>A: {item.ownerValuePass ? "PASS" : "FAIL"} · B: {item.economicIntervalPass ? "PASS" : "FAIL"}</Text>

              </View>

            </TouchableOpacity>

          ))}

          <Text style={styles.chartNote}>Select any scenario to inspect its complete calculation.</Text>

        </Card>

 

        {!!selected && (

          <Card>

            <Text style={styles.cardTitle}>Selected scenario · {selected.id}</Text>

            <Text style={styles.muted}>{selected.description}</Text>

            <View style={styles.divider} />

            <Metric label="Annual discharged energy" value={`${fmt2(selected.annualEnergy)} kWh/year`} />

            <Metric label="Annual charging energy" value={`${fmt2(selected.annualCharge)} kWh/year`} />

            <Metric label="Annual efficiency loss" value={`${fmt2(selected.annualEfficiencyLoss)} kWh/year`} />

            <Metric label="Charging tariff used" value={`Rs. ${fmt2(selected.chargingTariff)}/kWh`} />

            <Metric label="Annual prosumer total cost" value={fmt(selected.ownerTotal)} />

            <Metric label="Prosumer BEP" value={`Rs. ${fmt2(selected.prosumerBEP)}/kWh`} color={C.teal} />

            <Metric label={selected.type === "V2G" ? "Actual owner export value" : "Avoided household value"} value={`Rs. ${fmt2(selected.ownerValue)}/kWh`} color={C.blue} />

            <Metric label="Owner-value margin (Test A)" value={`Rs. ${fmt2(selected.ownerValueMargin)}/kWh`} color={selected.ownerValuePass ? C.green : C.red} />

            <Metric label="Utility COST BEP" value={`Rs. ${fmt2(selected.utilityCostBEP)}/kWh`} />

            <Metric label="Utility BASE economic ceiling" value={`Rs. ${fmt2(selected.utilityBaseEconomicCeiling)}/kWh`} color={C.blue} />

            <Metric label="Economic gap (Test B)" value={`Rs. ${fmt2(selected.economicGap)}/kWh`} color={selected.economicIntervalPass ? C.green : C.red} />

            <Text style={[styles.eligibilityText, { color: selected.ownerValuePass ? C.green : C.red }]}>{selected.ownerValuePass ? "✓ Test A passes: owner value ≥ Prosumer BEP" : "✗ Test A fails: owner value is below Prosumer BEP"}</Text>

            <Text style={[styles.eligibilityText, { color: selected.economicIntervalPass ? C.green : C.red }]}>{selected.economicIntervalPass ? "✓ Test B passes: Utility BASE ceiling > Prosumer BEP" : "✗ Test B fails: Utility BASE ceiling is not greater than Prosumer BEP"}</Text>

          </Card>

        )}

 

        {role === "Utility Officer" && !!selected && (

          <Card style={styles.utilityCard}>

            <Text style={styles.utilityHeading}>UTILITY OFFICER · FULL WORKBOOK CALCULATION</Text>

            <Text style={styles.cardTitle}>A. Common energy and weighted tariffs</Text>

            <DetailRow label="Annual discharged energy" value={`${fmt2(selected.dailyEnergy)} × ${inputs.operatingDays} = ${fmt2(selected.annualEnergy)} kWh/year`} />

            <DetailRow label="Annual charging energy" value={`${fmt2(selected.annualEnergy)} ÷ ${fmt2(num(inputs.efficiency) / 100)} = ${fmt2(selected.annualCharge)} kWh/year`} />

            <DetailRow label="Annual efficiency loss" value={`${fmt2(selected.annualCharge)} − ${fmt2(selected.annualEnergy)} = ${fmt2(selected.annualEfficiencyLoss)} kWh/year`} />

            <DetailRow label="Day charging quantity" value={`${fmt2(inputs.dayKwh)} kWh/day`} />

            <DetailRow label="Off-peak charging quantity" value={`${fmt2(inputs.offPeakKwh)} kWh/day`} />

            <DetailRow label="Home weighted tariff" value={`[(${inputs.homeDayTariff} × ${inputs.dayKwh}) + (${inputs.homeOffPeakTariff} × ${inputs.offPeakKwh})] ÷ (${inputs.dayKwh} + ${inputs.offPeakKwh}) = Rs. ${fmt2(selected.homeWeightedTariff)}/kWh`} />

            <DetailRow label="CS retail weighted tariff" value={`[(${inputs.csRetailDayTariff} × ${inputs.dayKwh}) + (${inputs.csRetailOffPeakTariff} × ${inputs.offPeakKwh})] ÷ (${inputs.dayKwh} + ${inputs.offPeakKwh}) = Rs. ${fmt2(selected.csRetailWeightedTariff)}/kWh`} />

            <DetailRow label="CS grid-purchase weighted tariff" value={`[(${inputs.csGridDayTariff} × ${inputs.dayKwh}) + (${inputs.csGridOffPeakTariff} × ${inputs.offPeakKwh})] ÷ (${inputs.dayKwh} + ${inputs.offPeakKwh}) = Rs. ${fmt2(selected.csGridPurchaseWeightedTariff)}/kWh`} />

            <DetailRow label="Annual charging cost" value={`${fmt2(selected.annualCharge)} × Rs. ${fmt2(selected.chargingTariff)} = ${fmt(selected.annualChargingCost)}`} />

            <DetailRow label="Annual battery degradation cost" value={`${fmt2(selected.annualEnergy)} × Rs. ${inputs.batteryDegradation} = ${fmt(selected.annualDegradationCost)}`} />

            <DetailRow label="Escalating present-value factor" value={fmt9(selected.pvFactor)} />

            <View style={styles.divider} />

            <Text style={styles.cardTitle}>B. Prosumer cost build-up</Text>

            <DetailRow label="Owner initial CAPEX" value={fmt(selected.ownerCapital)} />

            <DetailRow label="Annualized owner CAPEX = CAPEX ÷ PVF" value={fmt(selected.ownerAnnualizedCapital)} />

            <DetailRow label="Annual owner O&M" value={fmt(selected.ownerAnnualOM)} />

            <DetailRow label="Annual fixed cost" value={fmt(selected.ownerAnnualFixedCost)} />

            <DetailRow label="Annual charging cost" value={fmt(selected.annualChargingCost)} />

            <DetailRow label="Annual degradation cost" value={fmt(selected.annualDegradationCost)} />

            <DetailRow label={`Service fee: Rs. ${fmt2(selected.serviceFeeRate)}/kWh × energy`} value={fmt(selected.annualServiceFee)} />

            <DetailRow label="Annual variable cost" value={fmt(selected.ownerAnnualVariableCost)} />

            <DetailRow label="Total annual owner cost" value={fmt(selected.ownerTotal)} valueColor={C.teal} />

            <DetailRow label="Prosumer BEP = total annual owner cost ÷ annual discharged energy" value={`Rs. ${fmt2(selected.prosumerBEP)}/kWh`} valueColor={C.teal} />

            <View style={styles.divider} />

            <Text style={styles.cardTitle}>C. Utility cost BEP and BASE economic ceiling</Text>

            <DetailRow label="Utility avoided-resource benefit" value={`${fmt2(selected.annualEnergy)} × Rs. ${inputs.baseAvoidedResourceValue} × ${inputs.utilityFactor} = ${fmt(selected.annualAvoidedResourceBenefit)}`} />

            <DetailRow label="Utility charging margin" value={`${fmt2(selected.annualCharge)} × (Rs. ${fmt2(selected.csGridPurchaseWeightedTariff)} − Rs. ${inputs.utilityChargingCostRate}) = ${fmt(selected.utilityChargingMargin)}`} />

            <DetailRow label="Integration/admin cost" value={fmt(selected.utilityAdminCost)} />

            <DetailRow label="Utility O&M" value={fmt(selected.utilityOM)} />

            <DetailRow label="Gross utility value" value={fmt(selected.grossUtilityValue)} />

            <DetailRow label="Utility initial CAPEX" value={fmt(selected.utilityCapex)} />

            <DetailRow label="Annualized utility CAPEX = CAPEX ÷ PVF" value={fmt(selected.utilityAnnualizedCapital)} />

            <DetailRow label="Utility annual fixed cost = annualized CAPEX + O&M" value={fmt(selected.utilityAnnualFixedCost)} />

            <DetailRow label="Charging-cost shortfall" value={fmt(selected.annualChargingCostShortfall)} />

            <DetailRow label="Utility net variable cost = admin + shortfall" value={fmt(selected.utilityAnnualNetVariableCost)} />

            <DetailRow label="Utility annual cost for COST BEP" value={fmt(selected.utilityAnnualCostForBEP)} />

            <DetailRow label="Utility COST BEP" value={`Rs. ${fmt2(selected.utilityCostBEP)}/kWh`} valueColor={C.blue} />

            <DetailRow label="Utility BASE economic ceiling = (base avoided value × factor) − Utility COST BEP" value={`Rs. ${fmt2(selected.utilityBaseEconomicCeiling)}/kWh`} valueColor={C.blue} />

            <DetailRow label="Economic gap = Utility BASE ceiling ● Prosumer BEP" value={`Rs. ${fmt2(selected.economicGap)}/kWh`} valueColor={selected.economicIntervalPass ? C.green : C.red} />

            <View style={styles.divider} />

            <Text style={styles.cardTitle}>D. Two independent viability tests</Text>

            <DetailRow label="Test A: Actual owner value" value={`Rs. ${fmt2(selected.ownerValue)}/kWh`} />

            <DetailRow label="Test A margin = owner value ≥ Prosumer BEP" value={`Rs. ${fmt2(selected.ownerValueMargin)}/kWh`} valueColor={selected.ownerValuePass ? C.green : C.red} />

            <DetailRow label="Test B: Utility BASE ceiling > Prosumer BEP" value={selected.economicIntervalPass ? "PASS" : "FAIL"} valueColor={selected.economicIntervalPass ? C.green : C.red} />

            <Text style={[styles.eligibilityText, { color: selected.viable ? C.green : C.red }]}>{selected.viable ? "THIS SCENARIO PASSES BOTH TESTS" : "THIS SCENARIO DOES NOT PASS BOTH TESTS"}</Text>

          </Card>

        )}

 

        <Card>

          <Text style={styles.cardTitle}>Research recommendation</Text>

          <Text style={styles.bodyText}>{best ? `Primary candidate: ${best.id} — ${best.route}. Owner-value margin: Rs. ${fmt2(best.ownerValueMargin)}/kWh. Economic gap: Rs. ${fmt2(best.economicGap)}/kWh.` : "No primary candidate is available because no scenario passes both tests."}</Text>

          <Text style={styles.bodyText}>{best && secondary ? `The current inputs identify ${best.id} as the primary candidate and ${secondary.id} as the secondary candidate. Only scenarios passing both tests are included in this ranking.` : best ? `Only ${best.id} passes both tests under the current inputs.` : "No scenario currently passes both tests."}</Text>

          <Text style={styles.muted}>This is a model-based conclusion. The V2H utility avoided-resource assumption and CAPEX/O&M values need confirmation before claiming commercial feasibility.</Text>

        </Card>

        <Button title="Edit assumptions and calculate again" onPress={() => setScreen("inputs")} />

      </>

    );

  };

  const renderSession = () => {

    const chargeHours = durationHours(session.chargeStart, session.chargeEnd);

    const dischargeHours = durationHours(session.dischargeStart, session.dischargeEnd);

    const dayRate = session.chargeSource === "Home"

      ? num(inputs.homeDayTariff)

      : num(inputs.csRetailDayTariff);

    const offPeakRate = session.chargeSource === "Home"

      ? num(inputs.homeOffPeakTariff)

      : num(inputs.csRetailOffPeakTariff);

    const chargingCostPreview =

      num(session.chargePeak) * num(inputs.peakTariff) +

      num(session.chargeDay) * dayRate +

      num(session.chargeOffPeak) * offPeakRate;

 

    return (

      <>

        {renderHeader()}

        <Heading title="Energy Session Calculator" subtitle="Estimate charging payments and V2G export income or V2H household bill savings for an individual energy session." />

        <Card>

          <Text style={styles.cardTitle}>01 · Charging operation</Text>

          <Text style={styles.muted}>Choose where the EV is charged, then enter the energy charged in each tariff period.</Text>

          <View style={styles.modeRow}>

            <TouchableOpacity style={[styles.modeButton, session.chargeSource === "Home" && styles.modeButtonActive]} onPress={() => updateSession("chargeSource", "Home")}>

              <Text style={[styles.modeText, session.chargeSource === "Home" && styles.modeTextActive]}>Home charging</Text>

            </TouchableOpacity>

            <TouchableOpacity style={[styles.modeButton, session.chargeSource === "Station" && styles.modeButtonActive]} onPress={() => updateSession("chargeSource", "Station")}>

              <Text style={[styles.modeText, session.chargeSource === "Station" && styles.modeTextActive]}>Station charging</Text>

            </TouchableOpacity>

          </View>

          <Field label="Peak charging energy" value={session.chargePeak} suffix="kWh" onChangeText={(v) => updateSession("chargePeak", v)} />

          <Field label="Day charging energy" value={session.chargeDay} suffix="kWh" onChangeText={(v) => updateSession("chargeDay", v)} />

          <Field label="Off-peak charging energy" value={session.chargeOffPeak} suffix="kWh" onChangeText={(v) => updateSession("chargeOffPeak", v)} />

          <DetailRow label="Estimated charging payment" value={fmt(chargingCostPreview)} valueColor={C.orange} />

          <Text style={styles.smallNote}>Peak energy uses the separate Peak tariff. Day and Off-peak energy use the selected Home or charging-station retail tariffs.</Text>

          <View style={styles.divider} />

          <Text style={styles.cardTitle}>Charging time</Text>

          <Field label="Charging start time" value={session.chargeStart} suffix="HH:MM" keyboardType="default" placeholder="22:30" onChangeText={(v) => updateSession("chargeStart", v)} />

          <Field label="Charging end time" value={session.chargeEnd} suffix="HH:MM" keyboardType="default" placeholder="06:30" onChangeText={(v) => updateSession("chargeEnd", v)} />

          <Text style={styles.timeHint}>{chargeHours === null ? "Enter valid 24-hour times." : `Calculated charging duration: ${chargeHours.toFixed(2)} hours`}</Text>

        </Card>

        <Card>

          <Text style={styles.cardTitle}>02 · Discharging operation</Text>

          <View style={styles.modeRow}>

            <TouchableOpacity style={[styles.modeButton, session.dischargeMode === "V2G" && styles.modeButtonActive]} onPress={() => updateSession("dischargeMode", "V2G")}><Text style={[styles.modeText, session.dischargeMode === "V2G" && styles.modeTextActive]}>V2G · Grid export</Text></TouchableOpacity>

            <TouchableOpacity style={[styles.modeButton, session.dischargeMode === "V2H" && styles.modeButtonActive]} onPress={() => updateSession("dischargeMode", "V2H")}><Text style={[styles.modeText, session.dischargeMode === "V2H" && styles.modeTextActive]}>V2H · Home supply</Text></TouchableOpacity>

          </View>

          <Field label="Discharged energy units" value={session.dischargeUnits} suffix="kWh" onChangeText={(v) => updateSession("dischargeUnits", v)} />

          <Field label="Discharging start time" value={session.dischargeStart} suffix="HH:MM" keyboardType="default" placeholder="18:30" onChangeText={(v) => updateSession("dischargeStart", v)} />

          <Field label="Discharging end time" value={session.dischargeEnd} suffix="HH:MM" keyboardType="default" placeholder="20:30" onChangeText={(v) => updateSession("dischargeEnd", v)} />

          <Text style={styles.timeHint}>{dischargeHours === null ? "Enter valid 24-hour times." : `Calculated discharging duration: ${dischargeHours.toFixed(2)} hours`}</Text>

          <Text style={styles.smallNote}>{session.dischargeMode === "V2G" ? `Estimated export income is calculated using Rs. ${num(inputs.v2gOwnerValue).toFixed(2)}/kWh.` : `Estimated avoided household energy cost is calculated using Rs. ${num(inputs.v2hOwnerValue).toFixed(2)}/kWh. This is a bill saving, not cash income.`}</Text>

          <Text style={styles.smallNote}>Session estimate uses the selected charging source. Peak session units use the separate Peak tariff value; the six-scenario BEP model uses only the Day/Off-peak weighted charging tariffs.</Text>

        </Card>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button title="Calculate session cost and benefit →" onPress={calculateSession} />

        {!!sessionResult && (

          <Card style={styles.bestCard}>

            <Text style={styles.eyebrow}>SESSION ESTIMATE</Text>

            <Text style={styles.cardTitle}>{sessionResult.mode === "V2G" ? "V2G grid-export estimate" : "V2H household-saving estimate"}</Text>

            <Metric label="Total charging energy" value={`${fmt2(sessionResult.chargingUnits)} kWh`} />

            <Metric label="Estimated charging payment" value={fmt(sessionResult.chargingCost)} color={C.orange} />

            <Metric label={sessionResult.mode === "V2G" ? "Estimated export income" : "Estimated household bill saving"} value={fmt(sessionResult.benefit)} color={C.teal} />

            <View style={styles.divider} />

            <Metric label={sessionResult.mode === "V2G" ? "Estimated net amount (income − charging cost)" : "Estimated net energy benefit (saving − charging cost)"} value={fmt(sessionResult.net)} color={sessionResult.net >= 0 ? C.green : C.red} />

            <Text style={styles.smallNote}>Estimate only. Actual bills, export settlement, taxes, fixed charges, metering rules, battery losses and approved programme conditions may change the result.</Text>

            <Button title="Save this session summary" secondary onPress={saveSession} />

          </Card>

        )}

        {!!sessionHistory.length && (

          <Card>

            <Text style={styles.cardTitle}>Recent saved session summaries</Text>

            {sessionHistory.map((item, index) => (

              <View key={`${item.calculatedAt}-${index}`} style={styles.historyItem}>

                <Text style={styles.actionTitle}>{item.mode} · {item.chargeSource} charging · {item.calculatedAt}</Text>

                <Text style={styles.muted}>Charge: {fmt2(item.chargingUnits)} kWh · Discharge: {fmt2(item.discharge)} kWh</Text>

                <Text style={styles.resultTeal}>{fmt(item.benefit)} estimated benefit</Text>

              </View>

            ))}

          </Card>

        )}

        <Card style={styles.warningCard}>

          <Text style={styles.warningTitle}>Important operating limitation</Text>

          <Text style={styles.muted}>This tab calculates and records estimates from the units and times entered by the customer. It does not start, stop or control a physical EV charger, battery, inverter or grid connection. Hardware/API integration and utility approval would be required for actual control.</Text>

        </Card>

      </>

    );

  };

 

  const renderGuide = () => (

    <>

      {renderHeader()}

      <Heading title="User Guide" subtitle="How to use EV Energy Advisor and understand its calculations." />

      <Card>

        <Text style={styles.cardTitle}>01 · Getting started</Text>

        <Text style={styles.bodyText}>Create a Customer or Utility Officer account, then log in. The Control Officer is a pre-registered account and is not available through public registration.</Text>

        <Text style={styles.bodyText}>Use the bottom navigation to move between Home, Inputs, Scenarios, Results, Energy Session, Tariffs and Profile. The available tabs depend on your account role.</Text>

      </Card>

      <Card>

        <Text style={styles.cardTitle}>02 · Customer features</Text>

        <Text style={styles.bodyText}>1. Enter battery capacity, daily discharged energy, efficiency and operating days in Inputs.</Text>

        <Text style={styles.bodyText}>2. Enter your Day and Off-peak charging energy quantities in kWh/day. These are energy units, not percentages.</Text>

        <Text style={styles.bodyText}>3. The app calculates the required daily charging energy from daily discharged energy and round-trip efficiency. Your Day and Off-peak quantities should add up to this requirement.</Text>

        <Text style={styles.bodyText}>4. Customers can view tariff rates but cannot edit them. The weighted tariff is recalculated automatically using the entered Day and Off-peak kWh quantities.</Text>

        <Text style={styles.bodyText}>5. Select Energy Session to enter the units charged in each TOU period, the charging/discharging hours, and the V2G or V2H discharge mode.</Text>

        <Text style={styles.bodyText}>6. Calculate the estimated charging payment and either grid-export income (V2G) or avoided household bill cost (V2H).</Text>

      </Card>

      <Card>

        <Text style={styles.cardTitle}>03 · Utility Officer features</Text>

        <Text style={styles.bodyText}>Utility Officers can edit model inputs, including default Day and Off-peak charging quantities in kWh/day, weighted tariffs, charging-cost assumptions, owner CAPEX and O&M, utility CAPEX and O&M, administration costs, avoided-resource value and economic assumptions.</Text>

        <Text style={styles.bodyText}>After calculating, select any scenario in Results to inspect the annual energy calculation, weighted tariffs, owner-side cost build-up, Utility COST BEP, Utility BASE economic ceiling, economic gap and the two independent viability tests.</Text>

      </Card>

      <Card>

        <Text style={styles.cardTitle}>04 · Control Officer features</Text>

        <Text style={styles.bodyText}>The Control Officer can update default Day and Off-peak charging quantities in kWh/day, home tariffs, charging-station retail tariffs, utility grid-purchase tariff assumptions, V2G owner value, V2H household value and base avoided-resource value in Tariff Management. Control Officer access is pre-registered in this demonstration version.</Text>

      </Card>

      <Card>

        <Text style={styles.cardTitle}>05 · Understanding the six scenarios</Text>

        {SCENARIOS.map((item) => (

          <View key={item.id} style={styles.guideScenario}>

            <Text style={styles.scenarioId}>{item.id} · {item.type} · {item.route}</Text>

            <Text style={styles.muted}>{item.description}</Text>

          </View>

        ))}

      </Card>

      <Card>

        <Text style={styles.cardTitle}>06 · BEP and recommendation rule</Text>

        <Text style={styles.bodyText}>Prosumer BEP = (Annual prosumer fixed cost + Annual prosumer variable cost) ÷ Annual discharged energy.</Text>

        <Text style={styles.bodyText}>Utility COST BEP = (Annual utility fixed cost + Annual utility net variable cost) ÷ Annual discharged energy.</Text>

        <Text style={styles.bodyText}>Utility BASE economic ceiling = (Base avoided-resource value × Utility factor) − Utility COST BEP. Economic gap = Utility BASE economic ceiling ● Prosumer BEP.</Text>

        <Text style={styles.bodyText}>Test A: Actual owner value must be greater than or equal to Prosumer BEP. V2G owner value is initially Rs. 45.80/kWh; V2H household avoided value is initially Rs. 70.00/kWh.</Text>

        <Text style={styles.bodyText}>Test B: Utility BASE economic ceiling must be strictly greater than Prosumer BEP. A scenario is recommended only when both tests pass. With the workbook baseline assumptions, S6 is the primary candidate and S2 is the secondary candidate.</Text>

      </Card>

      <Card>

        <Text style={styles.cardTitle}>07 · Tariff periods and weighted tariff</Text>

        <DetailRow label="Default Day charging quantity" value={`${fmt2(inputs.dayKwh)} kWh/day`} />

        <DetailRow label="Default Off-peak charging quantity" value={`${fmt2(inputs.offPeakKwh)} kWh/day`} />

        <ReadOnlyTariff

          label="Home weighted tariff"

          value={weightedTariff(inputs.homeDayTariff, inputs.homeOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh)}

          time="Calculated from Day and Off-peak kWh"

        />

        <ReadOnlyTariff

          label="CS retail weighted tariff"

          value={weightedTariff(inputs.csRetailDayTariff, inputs.csRetailOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh)}

          time="Calculated from Day and Off-peak kWh"

        />

        <ReadOnlyTariff

          label="CS grid-purchase weighted tariff"

          value={weightedTariff(inputs.csGridDayTariff, inputs.csGridOffPeakTariff, inputs.dayKwh, inputs.offPeakKwh)}

        />

        <Text style={styles.smallNote}>Tariff rates are configurable by authorised roles. The applicable tariff category, effective date and customer eligibility should always be confirmed. The report's BEP weighted tariff does not include Peak charging.</Text>

      </Card>

      <Card style={styles.warningCard}>

        <Text style={styles.warningTitle}>Demo, authentication and hardware limitations</Text>

        <Text style={styles.muted}>This version keeps account, tariff changes, session history and results in React state during the current app session. They are not securely stored in a database and may reset when the app is restarted. The pre-registered Control Officer credentials are demonstration credentials embedded in this source code. Do not use this local-only login for real utility access or sensitive customer data. A production release needs a secure backend, password hashing, role-based permissions and audit logs. The Energy Session tab is a calculator/log, not live charger control.</Text>

      </Card>

    </>

  );

 

  const renderProfile = () => (

    <>

      {renderHeader()}

      <Heading title="My Profile" subtitle="Account information." />

      <Card>

        <View style={styles.profileLargePlaceholder}><Text style={styles.profileLargeInitial}>{(initials || "E").charAt(0).toUpperCase()}</Text></View>

        <Text style={styles.profileName}>{fullName}</Text>

        <Text style={styles.profileEmail}>{initials}</Text>

        <Text style={styles.profileEmail}>{email}</Text>

        {!!mobile && <Text style={styles.profileEmail}>{mobile}</Text>}

        <View style={styles.divider} />

        <Metric label="Account type" value={role} />

        <Button title="Sign out" secondary onPress={signOut} />

      </Card>

    </>

  );

 

  const getTabs = () => {

    if (role === "Customer") {

      return [

        ["Home", "dashboard", "⚡"],

        ["Inputs", "inputs", "◈"],

        ["Results", "results", "✧"],

        ["Session", "session", "ϟ"],

        ["Guide", "guide", "✦"],

        ["Profile", "profile", "◉"],

      ];

    }

 

    if (role === "Utility Officer") {

      return [

        ["Home", "dashboard", "⚡"],

        ["Inputs", "inputs", "◈"],

        ["Scenarios", "scenarios", "✴"],

        ["Results", "results", "✧"],

        ["Tariffs", "tariffs", "ϟ"],

        ["Guide", "guide", "✦"],

        ["Profile", "profile", "◉"],

      ];

    }

 

    return [

      ["Home", "dashboard", "⚡"],

      ["Tariffs", "tariffs", "ϟ"],

      ["Guide", "guide", "✦"],

      ["Profile", "profile", "◉"],

    ];

  };

 

  const renderMain = () => {

    if (screen === "welcome") return renderWelcome();

    if (screen === "login") return renderLogin();

    if (screen === "register") return renderRegister();

 

    return (

      <SafeAreaView style={styles.safe}>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="none" showsVerticalScrollIndicator={false}>

            {screen === "dashboard" && renderDashboard()}

            {screen === "inputs" && renderInputs()}

            {screen === "scenarios" && renderScenarios()}

            {screen === "results" && renderResults()}

            {screen === "session" && role === "Customer" && renderSession()}

            {screen === "tariffs" && renderTariffs()}

            {screen === "guide" && renderGuide()}

            {screen === "profile" && renderProfile()}

          </ScrollView>

          <View style={styles.bottomNavWrap}>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bottomNav}>

              {getTabs().map(([label, target, icon]) => (

                <TouchableOpacity key={target} style={styles.navItem} onPress={() => { setError(""); setScreen(target); }} activeOpacity={0.78}>

                  <View style={[styles.navIconWrap, screen === target && styles.navIconWrapActive]}>

                    <Text style={[styles.navIcon, screen === target && styles.navIconActive]}>{icon}</Text>

                  </View>

                  <Text style={[styles.navLabel, screen === target && styles.navLabelActive]}>{label}</Text>

                </TouchableOpacity>

              ))}

            </ScrollView>

          </View>

        </KeyboardAvoidingView>

      </SafeAreaView>

    );

  };

 

  return (

    <View style={styles.appRoot}>

      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

 

      {/* Animated plasma globe: layered glow, moving arcs and electric filaments. */}

      <View pointerEvents="none" style={styles.plasmaBackground}>

        <Animated.View

          style={[

            styles.plasmaAura,

            styles.plasmaAuraPink,

            {

              opacity: plasmaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.30, 0.62] }),

              transform: [

                { translateX: plasmaDrift.interpolate({ inputRange: [0, 1], outputRange: [-34, 38] }) },

                { translateY: plasmaDrift.interpolate({ inputRange: [0, 1], outputRange: [24, -28] }) },

                { scale: plasmaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.13] }) },

              ],

            },

          ]}

        />

        <Animated.View

          style={[

            styles.plasmaAura,

            styles.plasmaAuraBlue,

            {

              opacity: plasmaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0.56] }),

              transform: [

                { translateX: plasmaDrift.interpolate({ inputRange: [0, 1], outputRange: [42, -30] }) },

                { translateY: plasmaDrift.interpolate({ inputRange: [0, 1], outputRange: [-24, 34] }) },

                { scale: plasmaPulse.interpolate({ inputRange: [0, 1], outputRange: [1.12, 0.90] }) },

              ],

            },

          ]}

        />

        <Animated.View

          style={[

            styles.plasmaRing,

            styles.plasmaRingOne,

            {

              opacity: plasmaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.82] }),

              transform: [{ rotate: plasmaDrift.interpolate({ inputRange: [0, 1], outputRange: ["-18deg", "22deg"] }) }],

            },

          ]}

        />

        <Animated.View

          style={[

            styles.plasmaRing,

            styles.plasmaRingTwo,

            {

              opacity: plasmaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.26, 0.66] }),

              transform: [{ rotate: plasmaDrift.interpolate({ inputRange: [0, 1], outputRange: ["28deg", "-24deg"] }) }],

            },

          ]}

        />

        <Animated.View

          style={[

            styles.plasmaCore,

            {

              opacity: plasmaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.76] }),

              transform: [{ scale: plasmaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.18] }) }],

            },

          ]}

        />

        <Animated.View

          style={[

            styles.plasmaFilament,

            styles.plasmaFilamentOne,

            { opacity: plasmaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0.72] }), transform: [{ translateY: plasmaDrift.interpolate({ inputRange: [0, 1], outputRange: [-45, 55] }), }, { rotate: "-28deg" }] },

          ]}

        />

        <Animated.View

          style={[

            styles.plasmaFilament,

            styles.plasmaFilamentTwo,

            { opacity: plasmaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.66] }), transform: [{ translateY: plasmaDrift.interpolate({ inputRange: [0, 1], outputRange: [48, -52] }), }, { rotate: "31deg" }] },

          ]}

        />

        <Animated.View

          style={[

            styles.plasmaFilament,

            styles.plasmaFilamentThree,

            { opacity: plasmaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.20, 0.60] }), transform: [{ translateX: plasmaDrift.interpolate({ inputRange: [0, 1], outputRange: [-30, 35] }), }, { rotate: "72deg" }] },

          ]}

        />

      </View>

 

      <View style={styles.appContent}>{renderMain()}</View>

    </View>

  );

}

 

/* =========================================================

   ALL STYLES

   ========================================================= */

const styles = StyleSheet.create({

  appRoot: { flex: 1, backgroundColor: C.bg, overflow: "hidden" },

  appContent: { flex: 1, backgroundColor: "transparent", zIndex: 2, elevation: 2 },

  plasmaBackground: { ...StyleSheet.absoluteFillObject, overflow: "hidden", backgroundColor: "#09020F", zIndex: 0, elevation: 0 },

  plasmaAura: { position: "absolute", width: 340, height: 340, borderRadius: 170, alignSelf: "center", top: "24%" },

  plasmaAuraPink: { backgroundColor: "#FF168F", shadowColor: "#FF2EA6", shadowOpacity: 0.95, shadowRadius: 85, elevation: 28 },

  plasmaAuraBlue: { backgroundColor: "#503CFF", shadowColor: "#6A66FF", shadowOpacity: 0.9, shadowRadius: 90, elevation: 24 },

  plasmaRing: { position: "absolute", alignSelf: "center", top: "26%", width: 300, height: 300, borderRadius: 150, borderWidth: 2 },

  plasmaRingOne: { borderColor: "rgba(255,105,205,0.72)", shadowColor: "#FF45C7", shadowOpacity: 0.95, shadowRadius: 22, elevation: 12 },

  plasmaRingTwo: { width: 250, height: 330, borderRadius: 165, borderColor: "rgba(111,211,255,0.66)", shadowColor: "#65DFFF", shadowOpacity: 0.9, shadowRadius: 18, elevation: 10 },

  plasmaCore: { position: "absolute", alignSelf: "center", top: "39%", width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(255,230,255,0.16)", borderWidth: 2, borderColor: "rgba(255,220,255,0.78)", shadowColor: "#FFFFFF", shadowOpacity: 1, shadowRadius: 32, elevation: 20 },

  plasmaFilament: { position: "absolute", width: 3, height: "72%", top: "12%", alignSelf: "center", borderRadius: 4 },

  plasmaFilamentOne: { backgroundColor: "rgba(255,100,211,0.72)", shadowColor: "#FF4BCB", shadowOpacity: 1, shadowRadius: 14, elevation: 12 },

  plasmaFilamentTwo: { width: 2, backgroundColor: "rgba(117,211,255,0.78)", shadowColor: "#5BD8FF", shadowOpacity: 1, shadowRadius: 12, elevation: 10 },

  plasmaFilamentThree: { width: 2, backgroundColor: "rgba(216,151,255,0.72)", shadowColor: "#C77AFF", shadowOpacity: 1, shadowRadius: 12, elevation: 10 },

  safe: { flex: 1, backgroundColor: "transparent" },

  scroll: { flex: 1 },

  content: { padding: 18, paddingBottom: 30 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 25 },

  brand: { color: C.teal, fontSize: 12, fontWeight: "900", letterSpacing: 2 },

  headerSub: { color: C.muted, fontSize: 9, marginTop: 5, letterSpacing: 1 },

  roleBadge: { backgroundColor: "#153B3A", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 8 },

  roleBadgeText: { color: C.teal, fontSize: 9, fontWeight: "900" },

  headingBlock: { marginBottom: 17 },

  heading: { color: C.text, fontSize: 25, fontWeight: "900", marginBottom: 5 },

  muted: { color: C.muted, fontSize: 12, lineHeight: 19 },

  mutedCenter: { color: C.muted, fontSize: 12, textAlign: "center", marginTop: 10 },

  card: { backgroundColor: "rgba(27,11,36,0.88)", borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 17, marginBottom: 15, shadowColor: C.pink, shadowOpacity: 0.20, shadowRadius: 13, elevation: 5 },

  cardTitle: { color: C.text, fontSize: 16, fontWeight: "800", marginBottom: 8 },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 15 },

  button: { minHeight: 50, backgroundColor: C.pink, borderRadius: 14, borderWidth: 1, borderColor: C.purple, alignItems: "center", justifyContent: "center", paddingHorizontal: 15, marginTop: 15, shadowColor: C.pink, shadowOpacity: 0.40, shadowRadius: 12, elevation: 6 },

  buttonText: { color: "#19051D", fontSize: 13, fontWeight: "900" },

  buttonSecondary: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border },

  buttonSecondaryText: { color: C.text },

  buttonDisabled: { opacity: 0.45 },

  buttonDisabledText: { color: C.muted },

 

  welcomeContent: { flexGrow: 1, justifyContent: "center", padding: 21, paddingTop: 35, paddingBottom: 30 },

  welcomeLogo: { width: 100, height: 100, borderRadius: 32, backgroundColor: "#153B3A", borderWidth: 1, borderColor: C.teal, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 25, position: "relative" },

  welcomeLogoText: { color: C.teal, fontSize: 39, fontWeight: "900" },

  logoDot: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: C.orange, right: 17, top: 17 },

  logoBolt: { position: "absolute", right: -9, bottom: -13, color: C.yellow, fontSize: 31, textShadowColor: "#FF8A3D", textShadowRadius: 12 },

  welcomeSmall: { color: C.teal, fontSize: 9, fontWeight: "900", letterSpacing: 2.5, textAlign: "center", marginBottom: 13 },

  welcomeMainTitle: { color: C.text, fontSize: 24, fontWeight: "700", textAlign: "center" },

  welcomeAppTitle: { color: C.teal, fontSize: 31, fontWeight: "900", textAlign: "center", marginTop: 5 },

  welcomeDescription: { color: C.muted, fontSize: 12, lineHeight: 21, textAlign: "center", marginTop: 15, marginBottom: 25 },

  welcomeFeatures: { flexDirection: "row", justifyContent: "space-between", marginBottom: 25, gap: 8 },

  welcomeFeature: { flex: 1, minHeight: 115, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 15, alignItems: "center", justifyContent: "center", padding: 8 },

  welcomeFeatureIcon: { color: C.teal, fontSize: 22, marginBottom: 8 },

  welcomeFeatureTitle: { color: C.text, fontSize: 10, fontWeight: "900", textAlign: "center" },

  welcomeFeatureText: { color: C.muted, fontSize: 9, marginTop: 5, textAlign: "center" },

  welcomeActions: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 21, padding: 18 },

  welcomeActionTitle: { color: C.text, fontSize: 18, fontWeight: "900" },

  welcomeActionSubtitle: { color: C.muted, fontSize: 11, marginTop: 5, lineHeight: 18 },

 

  loginContent: { flexGrow: 1, justifyContent: "center", padding: 19, paddingBottom: 30 },

  backButton: { alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 4, marginBottom: 10 },

  backButtonText: { color: C.teal, fontSize: 14, fontWeight: "800" },

  loginLogo: { width: 75, height: 75, borderRadius: 24, backgroundColor: "#153B3A", borderWidth: 1, borderColor: C.teal, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 18 },

  loginLogoText: { color: C.teal, fontSize: 29, fontWeight: "900" },

  loginTitle: { color: C.text, fontSize: 27, fontWeight: "900", textAlign: "center" },

  loginSubtitle: { color: C.muted, fontSize: 12, textAlign: "center", marginTop: 8, marginBottom: 24, lineHeight: 19 },

  loginFooter: { color: C.muted, textAlign: "center", fontSize: 9, letterSpacing: 2, marginTop: 18 },

  profileLargePlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#153B3A", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14 },

  profileLargeInitial: { color: C.teal, fontSize: 35, fontWeight: "900" },

  field: { marginTop: 15 },

  fieldLabel: { color: C.muted, fontSize: 11, fontWeight: "700", marginBottom: 7 },

  inputWrap: { minHeight: 49, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },  inputDisabled: { opacity: 0.7 },

  input: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 10 },

  suffix: { color: C.muted, fontSize: 10, marginLeft: 8 },

  passwordRow: { minHeight: 49, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },

  passwordInput: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 10 },

  showPassword: { color: C.teal, fontSize: 10, fontWeight: "900", padding: 8 },

  roleCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 15, padding: 13, marginTop: 11 },

  roleCardActive: { borderColor: C.teal, backgroundColor: "#123432" },

  roleCardIcon: { fontSize: 25, marginRight: 12 },

  roleCardTitle: { color: C.text, fontSize: 13, fontWeight: "900" },

  roleCardDescription: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 4 },

  radioText: { color: C.teal, fontSize: 19, marginLeft: 8 },

  error: { color: C.red, fontSize: 12, marginTop: 12, lineHeight: 18 },

  smallNote: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 12 },

 

  welcomeBanner: { backgroundColor: "#242044", borderRadius: 23, borderWidth: 1, borderColor: C.purple, padding: 19, marginBottom: 25, shadowColor: C.pink, shadowOpacity: 0.16, shadowRadius: 14, elevation: 3 },

  eyebrow: { color: C.teal, fontSize: 9, fontWeight: "900", letterSpacing: 2 },

  welcomeRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },

  welcomeTitle: { color: C.text, fontSize: 25, fontWeight: "900" },

  smallProfile: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#1A4947", alignItems: "center", justifyContent: "center", marginLeft: 10 },

  smallProfileText: { color: C.teal, fontSize: 22, fontWeight: "900" },

  bannerFooter: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#315253", paddingTop: 13, marginTop: 18 },

  bannerCaption: { color: "#A8C3C5", fontSize: 9, fontWeight: "800" },

  readyCaption: { color: C.teal, fontSize: 9, fontWeight: "900" },

  overviewGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },

  overviewCard: { width: "48%", minHeight: 130, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 17, padding: 14, marginBottom: 12, justifyContent: "center" },

  overviewIcon: { fontSize: 21, marginBottom: 9 },

  overviewLabel: { color: C.muted, fontSize: 10, marginBottom: 7 },

  overviewValue: { color: C.text, fontSize: 20, fontWeight: "900" },

  featurePillRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 13 },

  featurePill: { overflow: "hidden", backgroundColor: "#173D36", color: C.teal, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15, fontSize: 9, fontWeight: "800" },

  actionCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 10 },

  actionIcon: { color: C.teal, fontSize: 22, width: 43, height: 43, textAlign: "center", textAlignVertical: "center", backgroundColor: "#183A3A", borderRadius: 13, overflow: "hidden", marginRight: 12 },

  actionTitle: { color: C.text, fontSize: 12, fontWeight: "800" },

  actionSubtitle: { color: C.muted, fontSize: 10, marginTop: 5 },

  arrow: { color: C.teal, fontSize: 25, marginLeft: 8 },

  utilityCard: { borderColor: "#4C4272" },

  utilityHeading: { color: C.purple, fontSize: 9, fontWeight: "900", letterSpacing: 1.5, marginBottom: 13 },

  analysisPanel: { backgroundColor: "#202C48", borderWidth: 1, borderColor: C.blue, borderRadius: 19, padding: 17, marginBottom: 20 },

  infoPanel: { backgroundColor: "#302442", borderWidth: 1, borderColor: C.pink, borderRadius: 13, padding: 12, marginTop: 15 },

  infoPanelTitle: { color: C.teal, fontSize: 11, fontWeight: "900", marginBottom: 5 },

 

  tariffRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },

  tariffName: { color: C.text, fontSize: 12, fontWeight: "800" },

  tariffTime: { color: C.muted, fontSize: 10, marginTop: 4 },

  tariffValue: { color: C.teal, fontSize: 12, fontWeight: "900", marginLeft: 10 },

  scenarioTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },

  scenarioId: { color: C.teal, fontSize: 14, fontWeight: "900" },

  scenarioType: { color: C.blue, backgroundColor: "#172D45", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, fontSize: 10, fontWeight: "900" },

  scenarioFactor: { color: C.purple, fontSize: 10, marginTop: 10, fontWeight: "700" },

 

  bestCard: { backgroundColor: "#111F2B", borderColor: "#28665D" },

  warningCard: { backgroundColor: "#2A1D1F", borderColor: "#714047" },

  warningTitle: { color: C.orange, fontSize: 15, fontWeight: "900", marginBottom: 8 },

  bestId: { color: C.teal, fontSize: 43, fontWeight: "900", marginTop: 12 },

  metricRow: { flexDirection: "row", gap: 8 },

  metric: { flex: 1, marginTop: 8, marginBottom: 5 },

  metricLabel: { color: C.muted, fontSize: 9, marginBottom: 6, lineHeight: 14 },

  metricValue: { fontSize: 12, fontWeight: "900" },

  eligibilityText: { color: C.green, fontSize: 11, fontWeight: "900", marginTop: 13 },

  legend: { flexDirection: "row", gap: 14, marginVertical: 10 },

  legendTeal: { color: C.teal, fontSize: 10 },

  legendBlue: { color: C.blue, fontSize: 10 },

  chart: { minHeight: 155, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around" },

  barGroup: { flex: 1, alignItems: "center" },

  chartLabel: { color: C.text, fontSize: 10, marginBottom: 6 },

  barPair: { height: 125, flexDirection: "row", gap: 4, alignItems: "flex-end" },

  barTrack: { height: 125, justifyContent: "flex-end" },

  bar: { width: 12, borderTopLeftRadius: 5, borderTopRightRadius: 5 },

  chartStatus: { fontSize: 7, marginTop: 5, fontWeight: "800" },

  chartNote: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 12 },

  resultRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 7, borderBottomWidth: 1, borderBottomColor: C.border, borderRadius: 9 },

  resultSelected: { backgroundColor: "#173238" },

  resultId: { color: C.text, fontSize: 12, fontWeight: "800" },

  resultTeal: { color: C.teal, fontSize: 12, fontWeight: "900" },

  resultBlue: { color: C.blue, fontSize: 12, fontWeight: "900", marginTop: 4 },

  resultGap: { fontSize: 10, fontWeight: "900", marginTop: 4 },

  resultStatus: { fontSize: 8, fontWeight: "900", marginTop: 5 },

  bodyText: { color: C.text, fontSize: 12, lineHeight: 20, marginBottom: 10 },

  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#25344A", gap: 12 },

  detailLabel: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 16 },

  detailValue: { flex: 1, color: C.text, fontSize: 10, fontWeight: "800", textAlign: "right", lineHeight: 16 },

 

  modeRow: { flexDirection: "row", gap: 8, marginTop: 8 },

  modeButton: { flex: 1, minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },

  modeButtonActive: { borderColor: C.teal, backgroundColor: "#123432" },

  modeText: { color: C.muted, fontSize: 10, fontWeight: "800" },

  modeTextActive: { color: C.teal },

  timeHint: { color: C.teal, fontSize: 10, marginTop: 9 },

  historyItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },

  guideScenario: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },

  profileName: { color: C.text, fontSize: 19, fontWeight: "900", textAlign: "center" },

  profileEmail: { color: C.muted, fontSize: 11, textAlign: "center", marginTop: 5 },

 

  bottomNavWrap: { backgroundColor: "#120719", borderTopWidth: 1, borderTopColor: C.pink, shadowColor: C.purple, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },

  bottomNav: { flexDirection: "row", alignItems: "center", paddingTop: 9, paddingBottom: Platform.OS === "ios" ? 18 : 9, paddingHorizontal: 5 },

  navItem: { minWidth: 70, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },

  navIconWrap: { width: 34, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 3, backgroundColor: "transparent" },

  navIconWrapActive: { backgroundColor: "#4A174F", borderWidth: 1, borderColor: C.pink, shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },

  navIcon: { color: C.muted, fontSize: 19, fontWeight: "800" },

  navIconActive: { color: C.yellow, fontSize: 20 },

  navLabel: { color: C.muted, fontSize: 9, fontWeight: "600" },

  navLabelActive: { color: C.electric, fontWeight: "900" },

});

 

