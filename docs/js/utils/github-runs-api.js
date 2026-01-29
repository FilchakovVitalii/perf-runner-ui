/**
 * GitHub Actions Runs API
 * Lists workflow runs for the configured workflow (used by History).
 *
 * @module GitHubRunsAPI
 */

const GitHubRunsAPI = {
    /**
     * List workflow runs for the given workflow
     * @param {Object} githubConfig - { owner, repo, workflow, branch, apiBase }
     * @param {string} token - GitHub personal access token
     * @param {Object} options - { per_page, page, status? } — omit status to get all runs (status=all returns empty)
     * @returns {Promise<{ success: boolean, runs?: Array, total_count?: number, message?: string }>}
     */
    async listWorkflowRuns(githubConfig, token, options = {}) {
        const { owner, repo, workflow, branch, apiBase } = githubConfig || {};
        if (!owner || !repo || !workflow || !apiBase) {
            return { success: false, message: 'Invalid GitHub configuration' };
        }
        if (!token) {
            return { success: false, message: 'Token required to list workflow runs' };
        }

        const per_page = Math.min(Number(options.per_page) || 20, 100);
        const page = Number(options.page) || 1;
        // Do not send status=all — GitHub API returns empty runs for that. Omit status to get all runs.
        const status = options.status;

        const url = new URL(
            `${apiBase}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs`
        );
        url.searchParams.set('per_page', per_page);
        url.searchParams.set('page', page);
        if (status) {
            url.searchParams.set('status', status);
        }
        if (branch) {
            url.searchParams.set('branch', branch);
        }

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `token ${token}`
                }
            });

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                let message = errBody.message || `HTTP ${response.status}`;
                if (response.status === 401) message = 'Authentication failed. Check token.';
                if (response.status === 403) message = 'Access forbidden. Token may lack repo scope.';
                if (response.status === 404) message = 'Workflow or repository not found.';
                return { success: false, message };
            }

            const data = await response.json();
            const runs = (data.workflow_runs || []).map((run) => ({
                id: run.id,
                run_number: run.run_number,
                name: run.name,
                display_title: run.display_title,
                status: run.status,
                conclusion: run.conclusion,
                html_url: run.html_url,
                created_at: run.created_at,
                updated_at: run.updated_at,
                head_branch: run.head_branch,
                event: run.event
                // GitHub API does not return workflow_dispatch inputs; config would come from artifacts later
            }));

            return {
                success: true,
                runs,
                total_count: data.total_count ?? runs.length
            };
        } catch (err) {
            console.error('GitHubRunsAPI listWorkflowRuns error:', err);
            return {
                success: false,
                message: err.message || 'Network error'
            };
        }
    }
};

if (typeof window !== 'undefined') {
    window.GitHubRunsAPI = GitHubRunsAPI;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubRunsAPI;
}
