# Lord of the Hyrox

Set the runner count, names, colors, and lap count. Each runner taps their tile to start, to count laps, and to restart after finishing. Each browser saves its own roster and timers.

To clear the roster and timers on the current device, open **Setup**, select **Restart app**, and confirm.

## Deploy to Cloudflare

Install the [Cloudflare CLI](https://developers.cloudflare.com/cf/get-started/) and run these commands from this directory.

```sh
cf auth login
cf deploy ./public
```

The Worker is named `hyrox`. Cloudflare serves the `public` directory at `hyrox.<account-subdomain>.workers.dev`.
