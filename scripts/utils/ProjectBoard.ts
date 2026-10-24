import { execFileSync } from "node:child_process";

import Repo from "./Repo";
import type IBacklogCard from "../types/IBacklogCard";
import type IBoardItem from "../types/IBoardItem";
import type IProjectRef from "../types/IProjectRef";

/**
 * Read and write access to the cnx project board.
 *
 * `scripts/setup-project.ts` held all of this privately, so a second consumer
 * would have had to restate the gh invocation, the scope-error handling and the
 * field names -- the two-place edit CLAUDE.md calls the worst anti-pattern here.
 * One declaration, both callers.
 *
 * Everything goes through the authenticated `gh` CLI rather than a token read
 * from the environment: locally that is the developer's own login, and in
 * Actions it is `GH_TOKEN`, with no branch between them.
 */
class ProjectBoard {
  /**
   * The board belongs to the organization that owns the repositories, so it
   * moves when they do (#2189). An organization-owned board is also what lets a
   * GitHub App write it; a user-owned one needed a personal token.
   */
  static readonly OWNER = Repo.OWNER;

  /**
   * Which of the owner's boards this is. The number, not the title, is the
   * board's identity: GitHub assigns it at creation and nothing changes it,
   * while a title can be renamed in the UI by anyone. The workflow and the
   * skills that cannot import this file name the board the same way, and a
   * test holds them to it.
   */
  static readonly NUMBER = 1;

  /** The board's title: what `project:setup` names it and keeps it named. */
  static readonly TITLE = "cnx";

  static readonly STATUS_FIELD = "Status";

  /**
   * Page size for one issue's "Blocked by" list. 12 is the longest on the board
   * (#1443, 2026-10-06); `columnCards` refuses a list longer than the page.
   */
  static readonly BLOCKED_BY_PAGE = 50;

  /** Runs a GraphQL document through the authenticated gh CLI. */
  static graphql(
    query: string,
    variables: Record<string, string> = {},
  ): Record<string, never> {
    const args = ["api", "graphql", "-f", `query=${query}`];
    for (const [name, value] of Object.entries(variables)) {
      args.push("-f", `${name}=${value}`);
    }
    let raw: string;
    try {
      raw = execFileSync("gh", args, {
        encoding: "utf-8",
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      if (details.includes("INSUFFICIENT_SCOPES")) {
        throw new Error(
          "The gh token cannot read Projects.\n\n  Run: gh auth refresh -s project\n",
          { cause: error },
        );
      }
      throw new Error(`GraphQL call failed:\n${details}`, { cause: error });
    }
    const parsed = JSON.parse(raw) as {
      data?: Record<string, never>;
      errors?: { message: string }[];
    };
    if (parsed.errors !== undefined && parsed.errors.length > 0) {
      throw new Error(
        `GraphQL errors:\n${parsed.errors.map((e) => `  ${e.message}`).join("\n")}`,
      );
    }
    if (parsed.data === undefined) {
      throw new Error("GraphQL response carried no data");
    }
    return parsed.data;
  }

  /**
   * The board, or undefined when it does not exist yet.
   *
   * Asks the owning organization for its board by number rather than searching
   * `viewer`'s boards by title: under a GitHub App token the viewer is the app's
   * bot, which owns no projects, and a direct read has no list to truncate.
   */
  static findProject(): IProjectRef | undefined {
    return ProjectBoard.lookup(
      "organization",
      ProjectBoard.OWNER,
      ProjectBoard.NUMBER,
    );
  }

  /** The owning organization's node id, which creating the board takes. */
  static ownerId(): string {
    const data = ProjectBoard.graphql(
      `
      query($owner: String!) {
        organization(login: $owner) { id }
      }
    `,
      { owner: ProjectBoard.OWNER },
    ) as unknown as { organization: { id: string } };
    return data.organization.id;
  }

  /**
   * Every card in one Status column, in the order the board displays them.
   *
   * Paginated deliberately: the board is past 200 items, and a bare
   * `items(first: 100)` truncates in silence, so a card past page one reads as
   * absent rather than erroring (CLAUDE.md, #1416). `fieldValues` is 30 against
   * 14 existing fields -- `--paginate` cannot advance a nested connection, so
   * an inner cap needs headroom instead.
   *
   * Blockers come from the issue's built-in "Blocked by" relationship, not a
   * board field (#1893): the board's free-text field was retired because it
   * was prose that had to be parsed, capped near 1 KB, and kept no history.
   */
  static columnCards(projectId: string, status: string): IBacklogCard[] {
    const cards: IBacklogCard[] = [];
    for (const node of ProjectBoard.itemNodes<{
      id: string;
      content: {
        number?: number;
        title?: string;
        blockedBy?: { totalCount: number; nodes: { number: number }[] };
      } | null;
      status: { name?: string } | null;
    }>(
      projectId,
      `
                  id
                  content {
                    ... on Issue {
                      number
                      title
                      blockedBy(first: ${ProjectBoard.BLOCKED_BY_PAGE}) {
                        totalCount
                        nodes { number }
                      }
                    }
                    ... on PullRequest { number title }
                  }
                  status: fieldValueByName(name: "${ProjectBoard.STATUS_FIELD}") {
                    ... on ProjectV2ItemFieldSingleSelectValue { name }
                  }
`,
    )) {
      if (node.content?.number === undefined) {
        continue;
      }
      if (node.status?.name !== status) {
        continue;
      }
      cards.push({
        number: node.content.number,
        itemId: node.id,
        blockedBy: ProjectBoard.blockers(
          node.content.number,
          node.content.blockedBy,
        ),
        title: node.content.title ?? "",
      });
    }
    return cards;
  }

  /**
   * Every item on the board, each with `fields` selected: the one paginated
   * read (#1416, #2115), so no caller can stop at page one
   */
  private static itemNodes<TNode>(projectId: string, fields: string): TNode[] {
    const nodes: TNode[] = [];
    let cursor = "";
    for (;;) {
      const page = ProjectBoard.graphql(
        `
        query($projectId: ID!, $cursor: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes {
${fields}                }
              }
            }
          }
        }
      `,
        cursor === "" ? { projectId } : { projectId, cursor },
      ) as unknown as {
        node: {
          items: {
            pageInfo: { hasNextPage: boolean; endCursor: string };
            nodes: TNode[];
          };
        };
      };
      nodes.push(...page.node.items.nodes);
      if (!page.node.items.pageInfo.hasNextPage) return nodes;
      cursor = page.node.items.pageInfo.endCursor;
    }
  }

  /**
   * The blocker numbers one page returned, refusing a page that is not the
   * whole list: a dropped blocker reads as "not blocked", in silence.
   */
  private static blockers(
    issue: number,
    page: { totalCount: number; nodes: { number: number }[] } | undefined,
  ): number[] {
    if (page === undefined) {
      return [];
    }
    if (page.totalCount > page.nodes.length) {
      throw new Error(
        `#${issue} has ${page.totalCount} blockers; one page read ${page.nodes.length}.`,
      );
    }
    return page.nodes.map((blocker) => blocker.number);
  }

  /** Places `itemId` directly below `afterId` in the board's own order. */
  static moveAfter(projectId: string, itemId: string, afterId: string): void {
    ProjectBoard.graphql(
      `
      mutation($projectId: ID!, $itemId: ID!, $afterId: ID!) {
        updateProjectV2ItemPosition(
          input: { projectId: $projectId, itemId: $itemId, afterId: $afterId }
        ) { clientMutationId }
      }
    `,
      { projectId, itemId, afterId },
    );
  }

  /**
   * Every issue and pull request card on a board, in the board's own order.
   *
   * Paginated: the board is past 1,000 items, and a capped first page reads
   * every card past it as absent (#1416). A draft item has no issue or pull
   * request behind it and is skipped -- nothing here can address it by content.
   */
  static items(projectId: string): IBoardItem[] {
    const items: IBoardItem[] = [];
    for (const node of ProjectBoard.itemNodes<{
      id: string;
      content: {
        id?: string;
        number?: number;
        repository?: { nameWithOwner: string };
      } | null;
      status: { name?: string } | null;
    }>(
      projectId,
      `
                  id
                  content {
                    ... on Issue { id number repository { nameWithOwner } }
                    ... on PullRequest { id number repository { nameWithOwner } }
                  }
                  status: fieldValueByName(name: "${ProjectBoard.STATUS_FIELD}") {
                    ... on ProjectV2ItemFieldSingleSelectValue { name }
                  }
`,
    )) {
      const content = node.content;
      if (
        content?.id === undefined ||
        content.number === undefined ||
        content.repository === undefined
      ) {
        continue;
      }
      items.push({
        itemId: node.id,
        contentId: content.id,
        status: node.status?.name,
        repository: content.repository.nameWithOwner,
        number: content.number,
      });
    }
    return items;
  }

  /** The Status field's id and its options, which every Status write takes. */
  static statusField(projectId: string): {
    fieldId: string;
    options: { id: string; name: string }[];
  } {
    const data = ProjectBoard.graphql(
      `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 100) {
              nodes {
                ... on ProjectV2FieldCommon { id name }
                ... on ProjectV2SingleSelectField { id name options { id name } }
              }
            }
          }
        }
      }
    `,
      { projectId },
    ) as unknown as {
      node: {
        fields: {
          nodes: {
            id: string;
            name: string;
            options?: { id: string; name: string }[];
          }[];
        };
      };
    };

    const status = data.node.fields.nodes.find(
      (field) => field.name === ProjectBoard.STATUS_FIELD,
    );
    if (status?.options === undefined) {
      throw new Error(
        `The project has no ${ProjectBoard.STATUS_FIELD} single-select field.`,
      );
    }
    return { fieldId: status.id, options: status.options };
  }

  /**
   * Puts an issue or pull request on the board and returns its item id. Adding
   * one that is already there returns the existing item.
   */
  static addItem(projectId: string, contentId: string): string {
    const data = ProjectBoard.graphql(
      `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(
          input: { projectId: $projectId, contentId: $contentId }
        ) { item { id } }
      }
    `,
      { projectId, contentId },
    ) as unknown as { addProjectV2ItemById: { item: { id: string } } };
    return data.addProjectV2ItemById.item.id;
  }

  /** Writes one card's Status. */
  static setStatus(
    projectId: string,
    itemId: string,
    fieldId: string,
    optionId: string,
  ): void {
    ProjectBoard.graphql(
      `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { singleSelectOptionId: $optionId }
          }
        ) { projectV2Item { id } }
      }
    `,
      { projectId, itemId, fieldId, optionId },
    );
  }

  /**
   * A board named by owner and number -- a board other than this one, such as
   * the one a migration copies from.
   */
  static projectAt(
    ownerType: "user" | "organization",
    owner: string,
    number: number,
  ): IProjectRef {
    const board = ProjectBoard.lookup(ownerType, owner, number);
    if (board === undefined) {
      throw new Error(`${ownerType} ${owner} has no project ${number}.`);
    }
    return board;
  }

  /**
   * The one read of a board by owner and number, behind both `findProject` and
   * `projectAt`.
   *
   * The number is written into the query text: `graphql` passes every variable
   * as a string, and `projectV2(number:)` takes an Int.
   */
  private static lookup(
    ownerType: "user" | "organization",
    owner: string,
    number: number,
  ): IProjectRef | undefined {
    if (!Number.isInteger(number) || number < 1) {
      throw new Error(`A project number is a positive integer, not ${number}.`);
    }
    const data = ProjectBoard.graphql(
      `
      query($owner: String!) {
        ${ownerType}(login: $owner) {
          projectV2(number: ${number}) { id number url }
        }
      }
    `,
      { owner },
    ) as unknown as Record<string, { projectV2: IProjectRef | null }>;

    const board = data[ownerType]?.projectV2;
    if (board === null || board === undefined) {
      return undefined;
    }
    return { id: board.id, number: board.number, url: board.url };
  }
}

export default ProjectBoard;
