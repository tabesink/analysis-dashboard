Superseded: these notes are historical context only. Current release and
deployment guidance lives in the repo root `AGENT.md` and `Deployment/README.md`.

Security posture options — quick study notes for junior dev
Option	Meaning	Pros	Cons	Example
A. Keep trusted-LAN plain HTTP	App runs over normal http:// inside a secure local network. No HTTPS yet.	Simplest to deploy. Few moving parts. Good for first internal version. Easy debugging.	Traffic is not encrypted. Anyone on the LAN could theoretically inspect requests. Not suitable for public internet.	http://192.168.1.50:3000 frontend + http://192.168.1.50:8000 backend
B. Add lightweight reverse proxy, no TLS yet	Put something like Nginx/Caddy in front of the app so users access one main address. Still HTTP.	Cleaner network shape. Can expose one port instead of many. Prepares app for future HTTPS.	Adds another service to configure. Still not encrypted.	User opens http://dashboard.local, proxy routes /api to backend and / to frontend
C. Add Caddy with internal TLS	Use Caddy to serve HTTPS using internal certificates.	Encrypted traffic on LAN. More production-like. Caddy handles a lot automatically.	More setup friction. Devices may not trust the certificate by default. Certificate trust-store setup can confuse users.	https://dashboard.local, but each workstation may need to trust the internal CA
D. Plain HTTP default + optional hardened reverse-proxy profile later	Start with simple HTTP, but design deployment files so HTTPS/proxy can be turned on later.	Best balance. Keeps v1 simple while leaving a clean upgrade path. Avoids overengineering.	Security is still basic in v1. Requires discipline to document the future hardened mode clearly.	deploy-dev.sh uses HTTP; later deploy-prod-hardened.sh enables reverse proxy and HTTPS
E. Other	Custom security model not covered above.	Flexible.	Easy to overcomplicate without a clear need.	VPN-only access, firewall rules, SSO, mTLS, etc.
Recommendation for first version

For a small 5–10 user app on a secure local network, I would choose:

D: Keep plain HTTP as the default, but design an optional hardened reverse-proxy profile for later.

That gives you the low-friction deployment of A, while avoiding a dead-end architecture. The first version should clearly document:

v1 security assumption:
- App is only accessible inside a trusted LAN.
- Do not expose directly to the public internet.
- Use firewall/router rules to restrict access.
- HTTP is acceptable for first local deployment.
- A hardened reverse-proxy/HTTPS profile will be added later.