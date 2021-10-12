import File = GoogleAppsScript.Drive.File;

interface IContext {
    tabFolder: Folder;
    masterSpreadsheet: MasterSpreadsheet;
    ballotFiles: File[];
    ballotSpreadsheets: BallotSpreadsheet[];
    teamInfo: Record<string, TeamInfo>;
    exportFolder: Folder;
    teamBallotFolder: (teamNumber: string) => Folder | undefined;
    setTeamBallotFolderLink: (teamNumber: string, ballotFolderLink: string) => boolean;
    tournamentEmail: string;

    teamResults: Record<string, TeamSummary>;
}

class Context implements IContext {
    @memoize
    get teamInfo(): Record<string, TeamInfo> {
        const teamInfoMapping: Record<string, TeamInfo> = {};
        compactRange(this.getRangeValues(MasterRange.TeamInfo)).forEach(row => {
            teamInfoMapping[row[0]] = {
                teamName: row[1],
                schoolName: row[2],
                emails: row[3],
                ballotFolderLink: row[4],
            };
        });
        return teamInfoMapping;
    }

    @memoize
    get teamResults(): Record<string, TeamSummary> {
        const teamResultMapping: Record<string, TeamSummary> = {};
        compactRange(this.getRangeValues(MasterRange.TeamResults)).forEach(row => {
            teamResultMapping[row[TeamResultsOutputIndex.TeamNumber]] = {
                ballotsWon: parseFloat(row[TeamResultsOutputIndex.BallotsWon]),
                combinedStrength: parseFloat(row[TeamResultsOutputIndex.CS]),
                pointDifferential: parseFloat(row[TeamResultsOutputIndex.PD]),
                timesPlaintiff: parseInt(row[TeamResultsOutputIndex.TimesPlaintiff]),
                timesDefense: parseInt(row[TeamResultsOutputIndex.TimesDefense]),
                pastOpponents: row[TeamResultsOutputIndex.PastOpponents].split(",")
            };
        });
        return teamResultMapping;
    }

    @memoize
    get tournamentName(): string {
        return this.getRangeValue(MasterRange.TournamentName);
    }

    @memoize
    get tournamentEmail(): string {
        return this.getRangeValue(MasterRange.TournamentEmail);
    }

    // This is inefficient but hassle free. Shouldn't be that hard to optimize if it becomes a bottleneck.
    setTeamBallotFolderLink(teamNumber: string, ballotFolderLink: string): boolean {
        const teamInfoRange = this.masterSpreadsheet.getRangeByName(MasterRange.TeamInfo);
        const teamInfoValues = teamInfoRange.getValues();
        const teamRow = teamInfoValues.find((teamRow: Cell[]) => teamRow[0]?.toString() === teamNumber);
        if (!teamRow) return false;
        teamRow[2] = ballotFolderLink;
        teamInfoRange.setValues(teamInfoValues);
        return true;
    }

    teamBallotFolder(teamNumber: string): Folder | undefined {
        const folderLink = this.teamInfo[teamNumber]?.ballotFolderLink;
        if (!folderLink) return undefined;
        return DriveApp.getFolderById(getIdFromUrl(folderLink))
    }

    @memoize
    get exportFolder(): Folder {
        return DriveApp.getFolderById(getIdFromUrl(this.masterSpreadsheet.getRangeByName(MasterRange.ExportFolderLink).getValue()));
    }

    @memoize
    get tabFolder(): Folder {
        return DriveApp.getFolderById(getIdFromUrl(this.masterSpreadsheet.getRangeByName(MasterRange.ParentFolderLink).getValue()));
    }

    @memoize
    get masterSpreadsheet(): MasterSpreadsheet {
        return SpreadsheetApp.getActiveSpreadsheet();
    }

    @memoize
    get ballotFiles(): File[] {
        const ballots: File[] = [];
        // TODO: Make this use the list of ballots in the master spreadsheet instead of this search
        const roundFolders = this.tabFolder.searchFolders('title contains "Round"');
        while (roundFolders.hasNext()) {
            const roundFolder = roundFolders.next();
            const trialFolders = roundFolder.getFolders();
            while (trialFolders.hasNext()) {
                const ballotFiles = trialFolders.next().searchFiles('title contains "Ballot"');
                while (ballotFiles.hasNext()) {
                    const file = ballotFiles.next();
                    ballots.push(file);
                }
            }
        }
        return ballots;
    }

    @memoize
    get ballotSpreadsheets(): BallotSpreadsheet[] {
        return this.ballotFiles.map(file => sheetForFile(file));
    }

    private getRangeValue(rangeName: MasterRange): string {
        return this.masterSpreadsheet.getRangeByName(rangeName).getValue().toString();
    }

    private getRangeValues(rangeName: MasterRange): string[][] {
        return this.masterSpreadsheet.getRangeByName(rangeName).getValues().map((arr: Cell[][]) => arr.map(cell => cell.toString()));
    }
}
