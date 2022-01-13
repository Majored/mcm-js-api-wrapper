// Copyright (c) 2021 MC-Market (Mick Capital Pty. Ltd.)
// MIT License (https://github.com/MC-Market-org/js-api-wrapper/blob/main/LICENSE)

const { AlertsHelper } = require("./helpers/AlertsHelper.js");
const { ConversationsHelper } = require("./helpers/ConversationsHelper.js");
const { ThreadsHelper } = require("./helpers/ThreadsHelper.js");
const { MembersHelper } = require("./helpers/members/MembersHelper.js");
const { ResourcesHelper } = require("./helpers/resources/ResourcesHelper.js");

/** The primary wrapping type for interactions with MC-Market's API. */
class Wrapper {
    /** The base API URL and version which will be prepended to non-absolute paths by axios. */
    static #BASE_URL = "https://api.mc-market.org/v1";

    /** The maximum number of objects returned by a list endpoint for a single request. */
    static #PER_PAGE = 20;

    /** The content type used for WRITE operations with bodies (ie. POST/PATCH). */
    static #WRITE_CONTENT_TYPE = "application/json";

    #client;
    #throttler;

    /** Initialise the wrapper with a provided API token.
     * 
     * @param {Token} token The 
     */
    async init(token) {
        // Create axios instance with our base URL and default headers.
        this.#client = axios.create({
            baseURL: #Wrapper.BASE_URL,
            headers: { Authorization: token.type + " " + token.value },
        });
    
        // Insert rate limiting store object.
        this.#throttler = {
            read_last_retry: 0,
            read_last_request: Date.now(),
            write_last_retry: 0,
            write_last_request: Date.now(),
        };

        // Make a request to the health endpoint. If errored, return the provided error instead of the wrapper object.
        let healthCheck = await this.health();
        if (healthCheck.result === "error") {
            return healthCheck;
        }
    
        return { result: "success" };
    }

    async get(endpoint, sort_options) {
        try {
            if (sort_options) {
                endpoint += utils.object_to_query_string(sort_options);
            }
    
            await utils.stall_if_required(this.rate_limits, false);
            let response = await this.client.get(endpoint);
    
            this.rate_limits.read_last_request = Date.now();
            this.rate_limits.read_last_retry = 0;
    
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                this.rate_limits.read_last_retry = error.response.headers["retry-after"];
                this.rate_limits.read_last_request = Date.now();
    
                return await this.get(endpoint);
            } else if (error.response) {
                return error.response.data;
            } else {
                return {
                    result: "error",
                    error: { code: "LocalWrapperError", message: error.message },
                };
            }
        }
    }

    async patch(endpoint, body) {
        try {
            await utils.stall_if_required(this.rate_limits, true);
            let response = await this.client.patch(endpoint, body, {
                headers: { "Content-Type": WRITE_CONTENT_TYPE },
            });
    
            this.rate_limits.write_last_request = Date.now();
            this.rate_limits.write_last_retry = 0;
    
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                this.rate_limits.write_last_retry = error.response.headers["retry-after"];
                this.rate_limits.write_last_request = Date.now();
    
                return await this.patch(endpoint, body);
            } else if (error.response) {
                return error.response.data;
            } else {
                return {
                    result: "error",
                    error: { code: "LocalWrapperError", message: error.message },
                };
            }
        }
    }

    async post(endpoint, body) {
        try {
            await utils.stall_if_required(this.rate_limits, true);
            let response = await this.client.post(endpoint, body, {
                headers: { "Content-Type": WRITE_CONTENT_TYPE },
            });
    
            this.rate_limits.write_last_request = Date.now();
            this.rate_limits.write_last_retry = 0;
    
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                this.rate_limits.write_last_retry = error.response.headers["retry-after"];
                this.rate_limits.write_last_request = Date.now();
    
                return await this.post(endpoint, body);
            } else if (error.response) {
                return error.response.data;
            } else {
                return {
                    result: "error",
                    error: { code: "LocalWrapperError", message: error.message },
                };
            }
        }
    }

    async delete(endpoint) {
        try {
            await utils.stall_if_required(this.rate_limits, true);
            let response = await this.client.delete(endpoint);
    
            this.rate_limits.write_last_request = Date.now();
            this.rate_limits.write_last_retry = 0;
    
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                this.rate_limits.write_last_retry = error.response.headers["retry-after"];
                this.rate_limits.write_last_request = Date.now();
    
                return await this.delete(endpoint);
            } else if (error.response) {
                return error.response.data;
            } else {
                return {
                    result: "error",
                    error: { code: "LocalWrapperError", message: error.message },
                };
            }
        }
    }

    async list_until(endpoint, should_continue, sort_options) {
        // Ensure an object is initialised if undefined, and that the page field exists.
        if (typeof sort_options === "undefined") {
            sort_options = {};
        }
        if (typeof sort_options.page === "undefined") {
            sort_options.page = 1;
        }

        let all_data = [];
        let continue_for = true;

        // This is continued until we either encounter an error, `should_continue` returns false, or we've reached the last
        // page (ie. data.length() != PER_PAGE).
        while (continue_for) {
        // If any requests return an error, pass the response to the caller rather than continuing.
            let response = await this.get(endpoint, sort_options);
            if (response.result === "error") {
                return response;
            }

            for (const index in response.data) {
                if (should_continue(response.data[index])) {
                    all_data.push(response.data[index]);
                } else {
                    continue_for = false;
                    break;
                }
            }

            if (response.data.length != PER_PAGE) {
                continue_for = false;
            }

            sort_options.page++;
        }

        return { result: "success", data: all_data };
    }

    async ping() {
        let start = Date.now();
        let response = await this.health();
        let stop = Date.now();
    
        if (response.result === "success") {
            response.data = stop - start;
        }
    
        return response;
    }

    alerts() {
        return new AlertsHelper(this);
    }

    conversations() {
        return new ConversationsHelper(this);
    }

    threads() {
        return new ThreadsHelper(this);
    }

    members() {
        return new MembersHelper(this);
    }

    resources() {
        return new ResourcesHelper(this);
    }
}