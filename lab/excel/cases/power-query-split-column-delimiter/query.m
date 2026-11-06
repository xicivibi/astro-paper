let S=Excel.CurrentWorkbook(){[Name="Input"]}[Content] in Table.SplitColumn(S,"Parts",Splitter.SplitTextByDelimiter("|",QuoteStyle.Csv),{"P1","P2","P3"})
