let S=Excel.CurrentWorkbook(){[Name="Input"]}[Content], T=Table.SplitColumn(S,"Parts",Splitter.SplitTextByDelimiter("|",QuoteStyle.Csv),{"P1","P2","P3"},null,ExtraValues.Error) in T
