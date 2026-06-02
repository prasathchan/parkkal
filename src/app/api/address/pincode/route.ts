import { NextRequest, NextResponse } from "next/server";

interface PostOffice {
  Name: string;
  Pincode: string;
  State: string;
  District: string;
}

interface PincodeApiResult {
  Status: string;
  PostOffice: PostOffice[] | null;
}

export async function GET(request: NextRequest) {
  const pincode = new URL(request.url).searchParams.get("pincode");
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ found: false, error: "Invalid pincode" }, { status: 400 });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: controller.signal });
    clearTimeout(timer);

    const data = (await res.json()) as PincodeApiResult[];
    if (!Array.isArray(data) || data[0].Status !== "Success") {
      return NextResponse.json({ found: false, error: "Pincode not found" });
    }
    const offices = data[0].PostOffice || [];
    const first = offices[0];
    return NextResponse.json({
      found: true,
      state: first.State,
      district: first.District,
      postOffices: offices.map((o) => ({ name: o.Name, pincode: o.Pincode })),
    });
  } catch {
    return NextResponse.json({ found: false, error: "Lookup failed" });
  }
}
