# Lord of the Hyrox

Set up the roster and laps per 1 km, choose events, review the session, and open the lap board. Each selected event has its own 1 km run and station in event-number order.

Each runner starts with a tap anywhere on their tile. Subsequent taps count laps. The last lap reveals the station while both clocks continue. Tap after the station to record the event and begin the next run or finish the workout. A finished tile opens the run, station, and event splits.

Each browser saves its own roster and timers. Previously saved lap boards can be resumed from the same device.

To clear the roster and timers on the current device, open **Setup**, select **Restart app**, and confirm.

Run `npm test` to check the workout timing logic.

## Deploy to Cloudflare

Install the [Cloudflare CLI](https://developers.cloudflare.com/cf/get-started/) and run these commands from this directory.

```sh
cf auth login
cf deploy ./public
```

The Worker is named `hyrox`. Cloudflare serves the `public` directory at `hyrox.<account-subdomain>.workers.dev`.
