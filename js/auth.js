document.getElementById("loginBtn").addEventListener("click", loginUser);

async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) return alert("Enter email and password!");

  const res = await fetch(sheetUrl(SHEET_USERS));
  const json = await res.json();

  const users = json.slice(1); // start from row 3
  const user = users.find(u => u.Email === email);
  if (!user) return alert("User not found!");
  if (user.IsBlocked === "TRUE") return alert("Account blocked!");
  if (user.PasswordHash !== password) return alert("Wrong password!");

  const now = new Date().toISOString();

  // ✅ Correct PATCH URL with sheet query
  const patchUrl = `${SHEETDB_BASE_URL}/Email/${encodeURIComponent(email)}`;


  const patchRes = await fetch(patchUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [{ LastLogin: now }] })
  });


  // Update locally
  user.LastLogin = now;
  localStorage.setItem("user", JSON.stringify(user));

  window.location.href = "dashboard.html";
}
