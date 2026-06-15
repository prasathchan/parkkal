"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/api/_client";

export interface AddressValue {
  country: string;
  state: string;
  district: string;
  city: string;
  pincode: string;
  fullAddress: string;
}

const COUNTRIES = [
  "India",
  "Afghanistan",
  "Argentina",
  "Australia",
  "Bangladesh",
  "Belgium",
  "Bhutan",
  "Brazil",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Denmark",
  "Egypt",
  "Ethiopia",
  "Finland",
  "France",
  "Germany",
  "Ghana",
  "Greece",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Italy",
  "Japan",
  "Jordan",
  "Kenya",
  "Malaysia",
  "Maldives",
  "Mexico",
  "Morocco",
  "Myanmar",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Philippines",
  "Poland",
  "Portugal",
  "Russia",
  "Saudi Arabia",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sweden",
  "Switzerland",
  "Tanzania",
  "Thailand",
  "Turkey",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Vietnam",
  "Zimbabwe",
];

const INDIA_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  // Union Territories
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

const INDIA_DISTRICTS: Record<string, string[]> = {
  "Tamil Nadu": [
    "Ariyalur",
    "Chengalpattu",
    "Chennai",
    "Coimbatore",
    "Cuddalore",
    "Dharmapuri",
    "Dindigul",
    "Erode",
    "Kallakurichi",
    "Kancheepuram",
    "Kanyakumari",
    "Karur",
    "Krishnagiri",
    "Madurai",
    "Mayiladuthurai",
    "Nagapattinam",
    "Namakkal",
    "Nilgiris",
    "Perambalur",
    "Pudukkottai",
    "Ramanathapuram",
    "Ranipet",
    "Salem",
    "Sivaganga",
    "Tenkasi",
    "Thanjavur",
    "Theni",
    "Thoothukudi",
    "Tiruchirappalli",
    "Tirunelveli",
    "Tirupathur",
    "Tiruppur",
    "Tiruvallur",
    "Tiruvannamalai",
    "Tiruvarur",
    "Vellore",
    "Viluppuram",
    "Virudhunagar",
  ],
  "Maharashtra": [
    "Mumbai",
    "Pune",
    "Nagpur",
    "Thane",
    "Nashik",
    "Aurangabad",
    "Solapur",
    "Kolhapur",
    "Amravati",
    "Nanded",
    "Satara",
    "Raigad",
  ],
  "Karnataka": [
    "Bengaluru Urban",
    "Bengaluru Rural",
    "Mysuru",
    "Hubballi-Dharwad",
    "Mangaluru",
    "Belagavi",
    "Kalaburagi",
    "Ballari",
    "Vijayapura",
    "Tumakuru",
    "Shivamogga",
    "Chitradurga",
  ],
  "Kerala": [
    "Thiruvananthapuram",
    "Kollam",
    "Pathanamthitta",
    "Alappuzha",
    "Kottayam",
    "Idukki",
    "Ernakulam",
    "Thrissur",
    "Palakkad",
    "Malappuram",
    "Kozhikode",
    "Wayanad",
    "Kannur",
    "Kasaragod",
  ],
  "Delhi": [
    "Central Delhi",
    "East Delhi",
    "New Delhi",
    "North Delhi",
    "North East Delhi",
    "North West Delhi",
    "Shahdara",
    "South Delhi",
    "South East Delhi",
    "South West Delhi",
    "West Delhi",
  ],
  "Gujarat": [
    "Ahmedabad",
    "Surat",
    "Vadodara",
    "Rajkot",
    "Gandhinagar",
    "Bhavnagar",
    "Jamnagar",
    "Junagadh",
    "Anand",
    "Mehsana",
  ],
  "Rajasthan": [
    "Jaipur",
    "Jodhpur",
    "Kota",
    "Bikaner",
    "Ajmer",
    "Udaipur",
    "Alwar",
    "Bharatpur",
    "Sikar",
    "Pali",
  ],
  "Uttar Pradesh": [
    "Lucknow",
    "Kanpur",
    "Agra",
    "Varanasi",
    "Prayagraj",
    "Ghaziabad",
    "Noida",
    "Meerut",
    "Bareilly",
    "Aligarh",
  ],
  "West Bengal": [
    "Kolkata",
    "Howrah",
    "North 24 Parganas",
    "South 24 Parganas",
    "Purba Bardhaman",
    "Nadia",
    "Hooghly",
    "Murshidabad",
    "Paschim Bardhaman",
    "Malda",
  ],
  "Andhra Pradesh": [
    "Visakhapatnam",
    "Vijayawada",
    "Guntur",
    "Nellore",
    "Kurnool",
    "Tirupati",
    "Kakinada",
    "Rajahmundry",
  ],
  "Telangana": [
    "Hyderabad",
    "Rangareddy",
    "Medchal-Malkajgiri",
    "Warangal Urban",
    "Karimnagar",
    "Khammam",
    "Nizamabad",
    "Nalgonda",
  ],
};

const INPUT_CLASS =
  "w-full px-3 py-2 border border-pk-border rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500";

interface AddressFormProps {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  required?: boolean;
}

export function AddressForm({ value, onChange, required }: AddressFormProps) {
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState("");
  const [pincodeSuccess, setPincodeSuccess] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const isIndia = value.country === "India";
  const districts = (isIndia && value.state) ? (INDIA_DISTRICTS[value.state] ?? []) : [];

  function update(field: keyof AddressValue, val: string) {
    onChange({ ...value, [field]: val });
  }

  function handleCountryChange(country: string) {
    onChange({ ...value, country, state: "", district: "", city: "", pincode: "" });
    setPincodeError("");
    setPincodeSuccess(false);
  }

  function handleStateChange(state: string) {
    onChange({ ...value, state, district: "", city: "", pincode: "" });
    setPincodeError("");
    setPincodeSuccess(false);
  }

  function handleDistrictChange(district: string) {
    onChange({ ...value, district, pincode: "" });
    setPincodeError("");
    setPincodeSuccess(false);
  }

  function handlePincodeChange(pincode: string) {
    onChange({ ...value, pincode });
    setPincodeError("");
    setPincodeSuccess(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (isIndia && /^\d{6}$/.test(pincode)) {
      debounceRef.current = setTimeout(() => lookupPincode(pincode), 600);
    }
  }

  async function lookupPincode(pincode: string) {
    setPincodeLoading(true);
    setPincodeError("");
    setPincodeSuccess(false);
    try {
      const data = await apiFetch<{ found: boolean; state?: string; district?: string }>(`/api/address/pincode?pincode=${pincode}`);
      if (data.found) {
        const cur = valueRef.current;
        onChange({ ...cur, pincode, state: data.state || cur.state, district: data.district || cur.district });
        setPincodeSuccess(true);
      }
    } catch {
      // API unreachable — ignore silently
    } finally {
      setPincodeLoading(false);
    }
  }

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Row 1: Country */}
      <div>
        <label className="block text-xs font-medium text-pk-text-secondary mb-1">Country</label>
        <select
          value={value.country}
          onChange={(e) => handleCountryChange(e.target.value)}
          required={required}
          className={INPUT_CLASS}
        >
          <option value="">Select Country</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Row 2: Pincode + State — Pincode first so auto-fill populates State before user picks it */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-pk-text-secondary mb-1">Pincode / ZIP</label>
          <div className="relative">
            <input
              type="text"
              value={value.pincode}
              onChange={(e) => handlePincodeChange(e.target.value)}
              placeholder={isIndia ? "6-digit PIN" : "Postal code"}
              maxLength={isIndia ? 6 : 20}
              className={`${INPUT_CLASS} pr-8`}
            />
            {pincodeLoading && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-pk-text-muted animate-spin text-xs">
                &#9696;
              </span>
            )}
            {pincodeSuccess && !pincodeLoading && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-pk-success-text text-xs">&#10003;</span>
            )}
          </div>
          {pincodeError && (
            <p className="text-xs text-pk-danger-text mt-0.5">{pincodeError}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-pk-text-secondary mb-1">State</label>
          {isIndia ? (
            <select
              value={value.state}
              onChange={(e) => handleStateChange(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Select State</option>
              {INDIA_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value.state}
              onChange={(e) => update("state", e.target.value)}
              placeholder="Enter state"
              className={INPUT_CLASS}
            />
          )}
        </div>
      </div>

      {/* Row 3: District + City */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-pk-text-secondary mb-1">District</label>
          <input
            type="text"
            list="district-options"
            value={value.district}
            onChange={(e) => handleDistrictChange(e.target.value)}
            placeholder="Enter or select district"
            className={INPUT_CLASS}
          />
          {districts.length > 0 && (
            <datalist id="district-options">
              {districts.map((d) => <option key={d} value={d} />)}
            </datalist>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-pk-text-secondary mb-1">City / Area</label>
          <input
            type="text"
            value={value.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="City or area"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {/* Row 4: Full address textarea */}
      <div>
        <label className="block text-xs font-medium text-pk-text-secondary mb-1">Street Address</label>
        <textarea
          value={value.fullAddress}
          onChange={(e) => update("fullAddress", e.target.value)}
          rows={2}
          placeholder="Door no., street, landmark..."
          className="w-full px-3 py-2 border border-pk-border rounded-pk-sm text-sm focus:outline-none focus:ring-2 focus:ring-pk-teal-500 resize-none"
        />
      </div>
    </div>
  );
}
