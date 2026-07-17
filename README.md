# AstroFin WhatsApp Bot — Setup Guide

This bot runs the Salary Shuttle application flow on WhatsApp: it answers FAQs and walks
applicants through submitting their name, ID number, and the 4 required documents, then
emails the team once everything's in.

## Environment variables needed (set these in your hosting platform, never commit real values to GitHub):
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_WHATSAPP_NUMBER
- NOTIFY_EMAIL_TO
- NOTIFY_EMAIL_FROM
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- PORT

## Run locally
npm install
npm start

## Deploy
Deployed via Render, connected to this GitHub repo. Webhook URL set in Twilio
console points to https://<your-render-url>/webhook
